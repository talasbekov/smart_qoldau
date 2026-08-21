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

interface PayoutWebhookBody {
  eventId: string;
  type: string;
  providerRefId: string;
}

// БЕЗ auth-guard'ов — аутентичность по HMAC-подписи тела
// (PAYOUT_WEBHOOK_SECRET), см. PaymentsWebhookController — тот же паттерн:
// rawBody, дедуп ProviderEvent (P2002 -> 200 no-op), неизвестный
// providerRefId -> 200 без эффекта.
@ApiTags('webhooks')
@Controller('webhooks')
export class PayoutsWebhookController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private events: EventsService,
    private config: ConfigService,
    private ledger: LedgerService,
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

    try {
      await this.prisma.providerEvent.create({
        data: {
          providerEventId: body.eventId,
          kind: 'payout',
          payload: body as unknown as object,
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        return;
      }
      throw e;
    }

    if (body.type !== 'payout.paid') {
      return;
    }

    await this.handlePayoutPaid(body.providerRefId);
  }

  // Провайдер подтвердил зачисление на карту: Payout PROCESSING -> PAID +
  // перекладка резерва payout:pending -> payout:sent (двойная запись,
  // идемпотентна по (kind='payout_sent', refId=payoutId)).
  private async handlePayoutPaid(providerRefId: string): Promise<void> {
    if (!providerRefId) return;

    const payout = await this.prisma.payout.findFirst({
      where: { providerRefId, status: PayoutStatus.PROCESSING },
    });
    if (!payout) return;

    const result = await this.prisma.$transaction(async (tx) => {
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
    if (!result) return;

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
  }
}
