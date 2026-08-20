import jwt from 'jsonwebtoken';
import { ConsultationStatus, Consultation } from '@prisma/client';
import { MediaService, roomNameFor } from './media.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../ws/events.service';
import { ConsultationsService } from '../consultations/consultations.service';

const CONFIG = {
  LIVEKIT_API_KEY: 'devkey',
  LIVEKIT_API_SECRET: 'devsecret-devsecret-devsecret-32',
  LIVEKIT_URL: 'ws://localhost:7880',
};

function makeConfig() {
  return { get: (key: string) => (CONFIG as Record<string, string>)[key] };
}

function makeConsultation(overrides: Partial<Consultation> = {}): Consultation {
  return {
    id: 'cons-unit-1',
    requestId: 'req-1',
    clientUserId: 'user-1',
    clientCode: 4242,
    expertId: 'expert-1',
    topicId: 'topic-1',
    format: 'chat',
    isEmergency: false,
    priceTiyn: 100000,
    plannedDurationMin: 50,
    status: ConsultationStatus.ACTIVE,
    outcome: null,
    startedAt: new Date(),
    endedAt: null,
    clientJoinedAt: null,
    expertJoinedAt: null,
    noShowNotifiedAt: null,
    ...overrides,
  } as Consultation;
}

describe('MediaService.issueToken', () => {
  let service: MediaService;

  beforeEach(() => {
    service = new MediaService(
      {} as unknown as PrismaService,
      { log: jest.fn() } as unknown as AuditService,
      {
        emitToUser: jest.fn(),
        emitToExpert: jest.fn(),
      } as unknown as EventsService,
      {} as unknown as ConsultationsService,
      makeConfig() as never,
    );
  });

  it('токен клиента: room=cons-{id}, identity=client-{clientCode}, grant roomJoin', async () => {
    const consultation = makeConsultation({ id: 'cons-abc', clientCode: 7777 });
    const { token, url, room } = await service.issueToken(
      consultation,
      'client',
    );

    expect(room).toBe(roomNameFor('cons-abc'));
    expect(room).toBe('cons-cons-abc');
    expect(url).toBe(CONFIG.LIVEKIT_URL);

    const decoded = jwt.decode(token) as Record<string, any>;
    expect(decoded.sub).toBe('client-7777');
    expect(decoded.video.room).toBe('cons-cons-abc');
    expect(decoded.video.roomJoin).toBe(true);
  });

  it('токен эксперта: identity=expert-{expertId}, без userId клиента', async () => {
    const consultation = makeConsultation({
      id: 'cons-xyz',
      expertId: 'expert-999',
    });
    const { token } = await service.issueToken(consultation, 'expert');

    const decoded = jwt.decode(token) as Record<string, any>;
    expect(decoded.sub).toBe('expert-expert-999');
    expect(decoded.video.room).toBe('cons-cons-xyz');
    expect(JSON.stringify(decoded)).not.toContain('user-1');
  });

  it('TTL токена ~2 часа', async () => {
    const consultation = makeConsultation();
    const { token } = await service.issueToken(consultation, 'client');
    const decoded = jwt.decode(token) as Record<string, any>;
    const ttlSeconds = decoded.exp - decoded.nbf;
    expect(ttlSeconds).toBe(2 * 60 * 60);
  });
});
