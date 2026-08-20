import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import * as crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { AccessToken } from 'livekit-server-sdk';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Номера спека задачи 4 (E4), не пересекаются с другими спеками.
const PH_E1 = '+77084000001';
const PH_C1 = '+77084000091';
const PH_C2 = '+77084000092'; // «чужой» пользователь (не-участник)
const ALL_PHONES = [PH_E1, PH_C1, PH_C2];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

function post(token: string, url: string) {
  return request(app.getHttpServer())
    .post(url)
    .set('Authorization', `Bearer ${token}`);
}
function get(token: string, url: string) {
  return request(app.getHttpServer())
    .get(url)
    .set('Authorization', `Bearer ${token}`);
}

let app: INestApplication;
let apiKey: string;
let apiSecret: string;

// Подписывает тело запроса как это делает LiveKit-сервер: sha256(body) в
// base64 в claim AccessToken.sha256, JWT — Authorization заголовок.
async function signWebhook(bodyString: string): Promise<string> {
  const hash = crypto.createHash('sha256').update(bodyString).digest('base64');
  const at = new AccessToken(apiKey, apiSecret, {});
  at.sha256 = hash;
  return at.toJwt();
}

function webhookBody(
  event: 'participant_joined' | 'participant_left',
  roomName: string,
  identity: string,
): string {
  return JSON.stringify({
    event,
    room: { name: roomName },
    participant: { identity },
  });
}

describe('LiveKit-токены, вебхуки участников, эскалация формата (e2e)', () => {
  let prisma: PrismaService;
  const registeredExpertIds: string[] = [];

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const experts = await prisma.expert.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const expertIds = experts.map((e) => e.id);
    const consultations = await prisma.consultation.findMany({
      where: {
        OR: [
          { expertId: { in: expertIds } },
          { clientUserId: { in: userIds } },
        ],
      },
      select: { id: true },
    });
    const consultationIds = consultations.map((c) => c.id);
    await prisma.chatMessage.deleteMany({
      where: { consultationId: { in: consultationIds } },
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entity: 'consultation' },
          { entity: 'expert', entityId: { in: expertIds } },
        ],
      },
    });
    await prisma.consultation.deleteMany({
      where: { id: { in: consultationIds } },
    });
    await prisma.expertScheduleDay.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expertDocument.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expertTopic.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expert.deleteMany({ where: { id: { in: expertIds } } });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...userIds, ...expertIds] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    registeredExpertIds.length = 0;
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    const config = app.get(ConfigService);
    apiKey = config.get<string>('LIVEKIT_API_KEY')!;
    apiSecret = config.get<string>('LIVEKIT_API_SECRET')!;
  });

  beforeEach(() => cleanup());

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function clientUser(phone: string) {
    return clientUserHelper(app, phone, () => lastCode);
  }

  // Эксперт (не через полный флоу верификации — не нужен для media/webhook
  // тестов, обходит нестабильный /me/documents multipart-эндпоинт из E2)
  // + консультация ACTIVE создаётся напрямую в БД — задача 4 тестирует
  // media-token/webhook, а не матчинг (уже покрыт задачами 2-3).
  async function expertUser(phone: string) {
    const auth = await clientUser(phone);
    const topic = await prisma.topic.findFirstOrThrow({
      where: { slug: 'anxiety-stress' },
    });
    const expert = await prisma.expert.create({
      data: {
        userId: auth.userId,
        displayName: 'Тест Эксперт',
        city: 'Алматы',
        experience: 'FIVE_TO_TEN',
        education: 'КазНУ им. аль-Фараби',
        priceTiyn: 399000,
        languages: ['ru'],
        formats: ['chat', 'audio', 'video'],
        verificationStatus: 'VERIFIED',
        topics: { create: [{ topicId: topic.id }] },
      },
    });
    registeredExpertIds.push(expert.id);
    return {
      accessToken: auth.accessToken,
      expertId: expert.id,
      topicId: topic.id,
    };
  }

  async function createConsultation(
    cli: { userId: string },
    exp: { expertId: string; topicId: string },
    format: 'chat' | 'audio' | 'video' = 'video',
  ) {
    const consultation = await prisma.consultation.create({
      data: {
        requestId: `req-media-${crypto.randomUUID()}`,
        clientUserId: cli.userId,
        clientCode: 4242,
        expertId: exp.expertId,
        topicId: exp.topicId,
        format,
        priceTiyn: 399000,
        startedAt: new Date(),
      },
    });
    return consultation;
  }

  it('media-token: участнику (клиенту и эксперту) 200 с корректным room/identity, не-участнику 404', async () => {
    const exp = await expertUser(PH_E1);
    const cli = await clientUser(PH_C1);
    const stranger = await clientUser(PH_C2);
    const consultation = await createConsultation(cli, exp, 'video');
    const consultationId = consultation.id;

    const clientRes = await post(
      cli.accessToken,
      `/v1/consultations/${consultationId}/media-token`,
    )
      .send({ format: 'video' })
      .expect(201);
    expect(clientRes.body.room).toBe(`cons-${consultationId}`);
    expect(clientRes.body.url).toBeDefined();
    const clientDecoded = jwt.decode(clientRes.body.token) as any;
    expect(clientDecoded.video.room).toBe(`cons-${consultationId}`);
    expect(clientDecoded.sub).toBe(`client-${consultation.clientCode}`);

    const expertRes = await post(
      exp.accessToken,
      `/v1/consultations/${consultationId}/media-token`,
    )
      .send({ format: 'video' })
      .expect(201);
    const expertDecoded = jwt.decode(expertRes.body.token) as any;
    expect(expertDecoded.sub).toBe(`expert-${exp.expertId}`);

    const strangerRes = await post(
      stranger.accessToken,
      `/v1/consultations/${consultationId}/media-token`,
    )
      .send({ format: 'video' })
      .expect(404);
    expect(strangerRes.body.error.code).toBe('CONSULTATION_NOT_FOUND');
  });

  it('эскалация chat->video отражается в GET консультации и в audit, повторный запрос video->audio -> 400', async () => {
    const exp = await expertUser(PH_E1);
    const cli = await clientUser(PH_C1);
    const consultation = await createConsultation(cli, exp, 'chat');
    const consultationId = consultation.id;

    const before = await get(
      cli.accessToken,
      `/v1/consultations/${consultationId}`,
    ).expect(200);
    expect(before.body.format).toBe('chat');

    await post(
      cli.accessToken,
      `/v1/consultations/${consultationId}/media-token`,
    )
      .send({ format: 'video' })
      .expect(201);

    const after = await get(
      cli.accessToken,
      `/v1/consultations/${consultationId}`,
    ).expect(200);
    expect(after.body.format).toBe('video');

    const audit = await prisma.auditLog.findFirst({
      where: {
        entity: 'consultation',
        entityId: consultationId,
        transition: 'consultation.format_escalated',
      },
    });
    expect(audit).not.toBeNull();
    expect(audit!.payload).toMatchObject({ from: 'chat', to: 'video' });

    // Понижение video -> audio запрещено.
    const downgrade = await post(
      exp.accessToken,
      `/v1/consultations/${consultationId}/media-token`,
    )
      .send({ format: 'audio' })
      .expect(400);
    expect(downgrade.body.error.code).toBe('VALIDATION_FAILED');

    // Формат в БД не изменился повторной попыткой понижения.
    const consultationAfter = await prisma.consultation.findUniqueOrThrow({
      where: { id: consultationId },
    });
    expect(consultationAfter.format).toBe('video');
  });

  it('вебхук: валидная подпись, participant_joined клиента проставляет clientJoinedAt (первое вхождение), повторный joined не дублирует', async () => {
    const exp = await expertUser(PH_E1);
    const cli = await clientUser(PH_C1);
    const consultation = await createConsultation(cli, exp, 'video');
    const consultationId = consultation.id;

    const roomName = `cons-${consultationId}`;
    const body = webhookBody(
      'participant_joined',
      roomName,
      `client-${consultation.clientCode}`,
    );
    const auth = await signWebhook(body);

    await request(app.getHttpServer())
      .post('/v1/webhooks/livekit')
      .set('Authorization', auth)
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(200);

    const afterFirst = await prisma.consultation.findUniqueOrThrow({
      where: { id: consultationId },
    });
    expect(afterFirst.clientJoinedAt).not.toBeNull();

    const audits = await prisma.auditLog.findMany({
      where: {
        entity: 'consultation',
        entityId: consultationId,
        transition: 'consultation.participant_joined',
      },
    });
    expect(audits.length).toBe(1);
    expect(audits[0].payload).toMatchObject({ role: 'client' });

    // Повторный joined того же участника: не перезаписывает, не дублирует audit.
    const firstJoinedAt = afterFirst.clientJoinedAt;
    const auth2 = await signWebhook(body);
    await request(app.getHttpServer())
      .post('/v1/webhooks/livekit')
      .set('Authorization', auth2)
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(200);

    const afterSecond = await prisma.consultation.findUniqueOrThrow({
      where: { id: consultationId },
    });
    expect(afterSecond.clientJoinedAt?.getTime()).toBe(
      firstJoinedAt?.getTime(),
    );
    const auditsAfter = await prisma.auditLog.findMany({
      where: {
        entity: 'consultation',
        entityId: consultationId,
        transition: 'consultation.participant_joined',
      },
    });
    expect(auditsAfter.length).toBe(1);
  });

  it('вебхук: participant_joined эксперта проставляет expertJoinedAt', async () => {
    const exp = await expertUser(PH_E1);
    const cli = await clientUser(PH_C1);
    const consultation = await createConsultation(cli, exp, 'video');
    const consultationId = consultation.id;

    const roomName = `cons-${consultationId}`;
    const body = webhookBody(
      'participant_joined',
      roomName,
      `expert-${exp.expertId}`,
    );
    const auth = await signWebhook(body);

    await request(app.getHttpServer())
      .post('/v1/webhooks/livekit')
      .set('Authorization', auth)
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(200);

    const after = await prisma.consultation.findUniqueOrThrow({
      where: { id: consultationId },
    });
    expect(after.expertJoinedAt).not.toBeNull();
    expect(after.clientJoinedAt).toBeNull();
  });

  it('вебхук: мусорная подпись -> 401 WEBHOOK_INVALID', async () => {
    const body = webhookBody(
      'participant_joined',
      'cons-does-not-matter',
      'client-1',
    );
    const res = await request(app.getHttpServer())
      .post('/v1/webhooks/livekit')
      .set('Authorization', 'garbage.not.a.jwt')
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(401);
    expect(res.body.error.code).toBe('WEBHOOK_INVALID');
  });

  it('вебхук: чужая/несуществующая комната -> 200 без эффекта', async () => {
    const body = webhookBody(
      'participant_joined',
      'cons-nonexistent-id',
      'client-1',
    );
    const auth = await signWebhook(body);
    await request(app.getHttpServer())
      .post('/v1/webhooks/livekit')
      .set('Authorization', auth)
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(200);

    const audits = await prisma.auditLog.findMany({
      where: { transition: 'consultation.participant_joined' },
    });
    expect(audits.length).toBe(0);
  });
});
