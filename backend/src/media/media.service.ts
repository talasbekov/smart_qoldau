import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { Consultation, ConsultationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../ws/events.service';
import {
  ConsultationsService,
  ParticipantRole,
} from '../consultations/consultations.service';
import { apiError } from '../common/filters/app-exception.filter';
import { MediaFormat } from './dto/media-token-request.dto';
import { MediaTokenResponseDto } from './dto/media-token-response.dto';

const TOKEN_TTL = '2h';

// Рейтинг форматов для эскалации: chat -> audio -> video. Понижение
// запрещено (см. requestMediaToken) — участники запрашивают токен на
// формат >= текущего.
const FORMAT_RANK: Record<string, number> = {
  chat: 0,
  audio: 1,
  video: 2,
};

export function roomNameFor(consultationId: string): string {
  return `cons-${consultationId}`;
}

@Injectable()
export class MediaService {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly url: string;

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private events: EventsService,
    private consultations: ConsultationsService,
    config: ConfigService,
  ) {
    this.apiKey = config.get<string>('LIVEKIT_API_KEY')!;
    this.apiSecret = config.get<string>('LIVEKIT_API_SECRET')!;
    this.url = config.get<string>('LIVEKIT_URL')!;
  }

  // Токен LiveKit для участника: identity скрывает PII (client-{clientCode},
  // никакого userId), grant — только на свою комнату cons-{id}, TTL 2ч.
  async issueToken(
    consultation: Consultation,
    role: ParticipantRole,
  ): Promise<{ token: string; url: string; room: string }> {
    const room = roomNameFor(consultation.id);
    const identity =
      role === 'client'
        ? `client-${consultation.clientCode}`
        : `expert-${consultation.expertId}`;

    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity,
      ttl: TOKEN_TTL,
    });
    at.addGrant({ roomJoin: true, room });
    const token = await at.toJwt();

    return { token, url: this.url, room };
  }

  // POST /v1/consultations/:id/media-token — участник ACTIVE-консультации
  // получает LiveKit-токен для запрошенного формата. Формат эскалируется
  // монотонно (chat=0 < audio=1 < video=2): запрос формата НИЖЕ текущего ->
  // VALIDATION_FAILED 400 (понижение запрещено). Запрос формата ВЫШЕ
  // текущего -> update format + audit consultation.format_escalated + WS
  // обеим сторонам consultation.updated. Равный формат — просто токен, без
  // побочных эффектов.
  async requestMediaToken(
    consultationId: string,
    userSub: string,
    format: MediaFormat,
  ): Promise<MediaTokenResponseDto> {
    const { consultation, role } = await this.consultations.resolveParticipant(
      consultationId,
      userSub,
    );

    if (consultation.status !== ConsultationStatus.ACTIVE) {
      apiError('CONSULTATION_NOT_ACTIVE', 'Консультация не активна', 409);
    }

    const currentRank = FORMAT_RANK[consultation.format] ?? 0;
    const requestedRank = FORMAT_RANK[format];

    if (requestedRank < currentRank) {
      apiError(
        'VALIDATION_FAILED',
        'Понижение формата консультации запрещено',
        400,
      );
    }

    let effective = consultation;
    if (requestedRank > currentRank) {
      const from = consultation.format;
      effective = await this.prisma.consultation.update({
        where: { id: consultation.id },
        data: { format },
      });

      await this.audit.log({
        actorType: role === 'client' ? 'user' : 'expert',
        actorId:
          role === 'client' ? consultation.clientUserId : consultation.expertId,
        entity: 'consultation',
        entityId: consultation.id,
        transition: 'consultation.format_escalated',
        payload: { from, to: format },
      });

      this.events.emitToUser(
        consultation.clientUserId,
        'consultation.updated',
        {
          id: consultation.id,
          format,
        },
      );
      this.events.emitToExpert(consultation.expertId, 'consultation.updated', {
        id: consultation.id,
        format,
      });
    }

    return this.issueToken(effective, role);
  }
}
