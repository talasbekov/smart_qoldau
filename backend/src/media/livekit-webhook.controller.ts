import {
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { WebhookReceiver } from 'livekit-server-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/filters/app-exception.filter';

const ROOM_PREFIX = 'cons-';
const CLIENT_PREFIX = 'client-';
const EXPERT_PREFIX = 'expert-';

// БЕЗ auth-guard'ов (LiveKit сам не умеет отправлять наш JWT) — аутентичность
// проверяется подписью WebhookReceiver (LIVEKIT_API_KEY/SECRET), не сессией
// пользователя. Тело должно быть СЫРЫМ (req.rawBody) — подпись считается по
// точным байтам запроса, распарсенный/пересобранный JSON не совпадёт по
// sha256. Эндпоинт присутствует в OpenAPI-схеме (путь известен) — не
// обычный клиентский API, вызывается сервером LiveKit, а не UI-клиентами.
@ApiTags('webhooks')
@Controller('webhooks')
export class LivekitWebhookController {
  private readonly receiver: WebhookReceiver;

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    config: ConfigService,
  ) {
    this.receiver = new WebhookReceiver(
      config.get<string>('LIVEKIT_API_KEY')!,
      config.get<string>('LIVEKIT_API_SECRET')!,
    );
  }

  @Post('livekit')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Вебхук LiveKit (без auth-guard — подпись проверяется WebhookReceiver)',
  })
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('authorization') authHeader?: string,
  ): Promise<void> {
    const rawBody = req.rawBody?.toString('utf8') ?? '';

    let event;
    try {
      event = await this.receiver.receive(rawBody, authHeader);
    } catch {
      apiError('WEBHOOK_INVALID', 'Invalid webhook signature', 401);
      return;
    }

    if (
      event.event !== 'participant_joined' &&
      event.event !== 'participant_left'
    ) {
      return;
    }

    const roomName = event.room?.name;
    const identity = event.participant?.identity;
    if (!roomName || !identity || !roomName.startsWith(ROOM_PREFIX)) {
      return; // неизвестная комната -> 200 без эффекта (не раскрываем существование)
    }

    const consultationId = roomName.slice(ROOM_PREFIX.length);
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
    });
    if (!consultation) {
      return; // несуществующая консультация -> 200 без эффекта
    }

    if (event.event !== 'participant_joined') {
      return;
    }

    let role: 'client' | 'expert' | null = null;
    if (identity.startsWith(CLIENT_PREFIX)) {
      role = 'client';
    } else if (identity.startsWith(EXPERT_PREFIX)) {
      role = 'expert';
    }
    if (!role) {
      return;
    }

    const alreadyJoined =
      role === 'client'
        ? consultation.clientJoinedAt !== null
        : consultation.expertJoinedAt !== null;
    if (alreadyJoined) {
      return; // первое вхождение уже отмечено -> не перезаписываем, не дублируем audit
    }

    await this.prisma.consultation.update({
      where: { id: consultation.id },
      data:
        role === 'client'
          ? { clientJoinedAt: new Date() }
          : { expertJoinedAt: new Date() },
    });

    await this.audit.log({
      actorType: 'system',
      entity: 'consultation',
      entityId: consultation.id,
      transition: 'consultation.participant_joined',
      payload: { role },
    });
  }
}
