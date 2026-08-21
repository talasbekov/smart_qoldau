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
import { PayoutStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../ws/events.service';
import { apiError } from '../common/filters/app-exception.filter';
import { WebhookSignature } from '../payments/provider/webhook-signature';
import {
  ACC_PAYOUT_PENDING,
  ACC_PAYOUT_SENT,
  LedgerService,
} from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { formatTenge } from '../notifications/notification-templates';

interface PayoutWebhookBody {
  eventId: string;
  type: string;
  providerRefId: string;
}

// БЕЗ auth-guard'ов — аутентичность по HMAC-подписи тела
// (PAYOUT_WEBHOOK_SECRET), см. PaymentsWebhookController — тот же паттерн:
// rawBody; дедуп ProviderEvent по (kind, eventId) атомарно с эффектом
// (P2002 -> 200 no-op); событие без эффекта — в т.ч. paid, обогнавший нашу
// запись providerRefId, — НЕ потребляется: переигровка провайдера доведёт.
@ApiTags('webhooks')
@Controller('webhooks')
export class PayoutsWebhookController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private events: EventsService,
    private config: ConfigService,
    private ledger: LedgerService,
    private notifications: NotificationsService,
  ) {}

  @Post('payouts')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Вебхук payout-провайдера (без auth-guard — подпись проверяется HMAC)',
  })
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-payout-signature') signature?: string,
  ): Promise<void> {
    const rawBody = req.rawBody ?? Buffer.from('');
    const secret = this.config.getOrThrow<string>('PAYOUT_WEBHOOK_SECRET');

    if (!signature || !WebhookSignature.verify(secret, rawBody, signature)) {
      apiError('WEBHOOK_INVALID', 'Invalid webhook signature', 401);
      return;
    }

    let body: PayoutWebhookBody;
    try {
      body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      apiError('WEBHOOK_INVALID', 'Invalid webhook payload', 401);
      return;
    }

    if (!body?.eventId) {
      apiError('WEBHOOK_INVALID', 'Missing eventId', 401);
      return;
    }

    if (body.type !== 'payout.paid') {
      return;
    }

    await this.handlePayoutPaid(body);
  }

  // Провайдер подтвердил зачисление на карту: Payout PROCESSING -> PAID +
  // перекладка резерва payout:pending -> payout:sent (двойная запись,
  // идемпотентна по (kind='payout_sent', refId=payoutId)). Дедуп-запись
  // события — первым стейтментом ТОЙ ЖЕ транзакции: сбой эффекта не должен
  // оставить eventId «потреблённым», иначе переигровка провайдера навсегда
  // упрётся в no-op при застрявшем PROCESSING.
  private async handlePayoutPaid(body: PayoutWebhookBody): Promise<void> {
    const providerRefId = body.providerRefId;
    if (!providerRefId) return;

    const payout = await this.prisma.payout.findFirst({
      where: { providerRefId, status: PayoutStatus.PROCESSING },
    });
    if (!payout) return;

    let applied = false;
    try {
      applied = await this.prisma.$transaction(async (tx) => {
        await tx.providerEvent.create({
          data: {
            providerEventId: body.eventId,
            kind: 'payout',
            payload: body as unknown as object,
          },
        });
        const updated = await tx.payout.updateMany({
          where: { id: payout.id, status: PayoutStatus.PROCESSING },
          data: { status: PayoutStatus.PAID },
        });
        if (updated.count === 0) return false;

        await this.ledger.post(
          'payout_sent',
          payout.id,
          [
            { account: ACC_PAYOUT_PENDING, debitTiyn: payout.amountTiyn },
            { account: ACC_PAYOUT_SENT, creditTiyn: payout.amountTiyn },
          ],
          tx,
        );
        return true;
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        return;
      }
      throw e;
    }
    if (!applied) return;

    await this.audit.log({
      actorType: 'system',
      entity: 'payout',
      entityId: payout.id,
      transition: 'payout.paid',
      payload: { providerRefId, amountTiyn: payout.amountTiyn },
    });

    // Уведомление эксперту: «выплата отправлена на карту **** NNNN».
    this.events.emitToExpert(payout.expertId, 'payout.updated', {
      id: payout.id,
      status: PayoutStatus.PAID,
    });

    // In-app + push (E9, задача 6): dispatch() сам никогда не бросает
    // (fire-and-forget) — сбой шины уведомлений не откатывает уже
    // зафиксированную выплату.
    const expertUser = await this.prisma.expert.findUnique({
      where: { id: payout.expertId },
      select: { userId: true },
    });
    if (expertUser) {
      await this.notifications.dispatch(expertUser.userId, 'payout.paid', {
        amountTiyn: payout.amountTiyn,
        amountTenge: formatTenge(payout.amountTiyn),
        maskedPan: payout.maskedPan,
        status: PayoutStatus.PAID,
      });
    }
  }
}
