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
import {
  ConsultationOutcome,
  ConsultationPaymentStatus,
  PaymentStatus,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EventsService } from '../ws/events.service';
import { apiError } from '../common/filters/app-exception.filter';
import { WebhookSignature } from './provider/webhook-signature';

interface PaymentWebhookBody {
  eventId: string;
  type: string;
  providerHoldId: string;
}

// БЕЗ auth-guard'ов (провайдер не умеет отправлять наш JWT) — аутентичность
// проверяется HMAC-подписью тела (PAYMENT_WEBHOOK_SECRET), не сессией
// пользователя. rawBody обязателен — подпись считается по точным байтам
// запроса (см. LivekitWebhookController, тот же паттерн). Дедуп повторных
// доставок — insert ProviderEvent по (kind, providerEventId) АТОМАРНО с
// эффектом события: потреблённый до эффекта eventId навсегда съедал бы
// денежное событие при транзиентном сбое эффекта. Событие без эффекта
// (неизвестный providerHoldId, неизвестный type) НЕ потребляется — 200 без
// записи, переигровка провайдера безвредна и может «догнать» гонку.
@ApiTags('webhooks')
@Controller('webhooks')
export class PaymentsWebhookController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private events: EventsService,
    private config: ConfigService,
  ) {}

  @Post('payments')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Вебхук платёжного провайдера (без auth-guard — подпись проверяется HMAC)',
  })
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-payment-signature') signature?: string,
  ): Promise<void> {
    const rawBody = req.rawBody ?? Buffer.from('');
    const secret = this.config.getOrThrow<string>('PAYMENT_WEBHOOK_SECRET');

    if (!signature || !WebhookSignature.verify(secret, rawBody, signature)) {
      apiError('WEBHOOK_INVALID', 'Invalid webhook signature', 401);
      return;
    }

    let body: PaymentWebhookBody;
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

    if (body.type !== 'hold.voided_by_bank') {
      return;
    }

    await this.handleHoldVoidedByBank(body);
  }

  // Банк сам снял истёкший холд (например, лимит времени удержания на
  // стороне банка/провайдера истёк раньше нашего sweep-перехолда). Payment
  // HELD -> FAILED; неизвестный providerHoldId -> 200 без эффекта (и без
  // потребления eventId), не раскрываем существование записи.
  private async handleHoldVoidedByBank(
    body: PaymentWebhookBody,
  ): Promise<void> {
    const providerHoldId = body.providerHoldId;
    if (!providerHoldId) return;

    const payment = await this.prisma.payment.findFirst({
      where: { providerHoldId, status: PaymentStatus.HELD },
    });
    if (!payment) return;

    const consultation = await this.prisma.consultation.findUnique({
      where: { id: payment.consultationId },
      select: { outcome: true },
    });

    // Дедуп-запись и эффект — одна транзакция: create по (kind, eventId)
    // первым стейтментом, его P2002 (повторная доставка) откатывает всё и
    // мапится в 200 no-op.
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.providerEvent.create({
          data: {
            providerEventId: body.eventId,
            kind: 'payment',
            payload: body as unknown as object,
          },
        });
        const result = await tx.payment.updateMany({
          where: { id: payment.id, status: PaymentStatus.HELD },
          data: {
            status: PaymentStatus.FAILED,
            failReason: 'Холд снят банком',
          },
        });
        if (result.count === 0) return;
        await tx.consultation.update({
          where: { id: payment.consultationId },
          data: { paymentStatus: ConsultationPaymentStatus.FAILED },
        });
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        return;
      }
      throw e;
    }

    // Услуга уже оказана (COMPLETED), а холд пропал — недособранная выручка,
    // отдельная крошка для финконтроля (взыскание вручную); штатный случай —
    // клиент просто заплатит заново (pay() разрешён после FAILED).
    const afterCompletion =
      consultation?.outcome === ConsultationOutcome.COMPLETED;
    await this.audit.log({
      actorType: 'system',
      entity: 'payment',
      entityId: payment.id,
      transition: afterCompletion
        ? 'payment.hold_voided_after_completion'
        : 'payment.hold_voided_by_bank',
      payload: { consultationId: payment.consultationId, providerHoldId },
    });

    this.events.emitToUser(payment.clientUserId, 'consultation.updated', {
      id: payment.consultationId,
      paymentStatus: ConsultationPaymentStatus.FAILED,
    });
    this.events.emitToExpert(payment.expertId, 'consultation.updated', {
      id: payment.consultationId,
      paymentStatus: ConsultationPaymentStatus.FAILED,
    });
  }
}
