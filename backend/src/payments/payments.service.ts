import { Injectable } from '@nestjs/common';
import {
  ConsultationPaymentStatus,
  ConsultationStatus,
  PaymentStatus,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { EventsService } from '../ws/events.service';
import { apiError } from '../common/filters/app-exception.filter';
import { ConsultationsService } from '../consultations/consultations.service';
import { PaymentProviderPort } from './provider/payment-provider.port';
import { PayResultDto } from './dto/pay-result.dto';
import { PaymentStatusDto } from './dto/payment-status.dto';

const COMMISSION_RATE = 0.15;

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private clock: ClockService,
    private events: EventsService,
    private consultations: ConsultationsService,
    private provider: PaymentProviderPort,
  ) {}

  // POST /v1/consultations/:id/pay — только клиент-участник ACTIVE-
  // консультации. Поток: upsert Payment (P2002 -> уже существующий; повтор
  // после FAILED — та же строка, сброс в PENDING с новой картой) ->
  // provider.hold(idempotencyKey='hold:'+consultationId) -> held: Payment
  // HELD + Consultation.paymentStatus HELD; declined: Payment FAILED +
  // paymentStatus FAILED, 402 PROVIDER_DECLINED.
  async pay(
    consultationId: string,
    userSub: string,
    paymentMethodId: string,
  ): Promise<PayResultDto> {
    const { consultation, role } = await this.consultations.resolveParticipant(
      consultationId,
      userSub,
    );
    if (role !== 'client') {
      apiError('CONSULTATION_NOT_FOUND', 'Консультация не найдена', 404);
    }
    if (consultation.status !== ConsultationStatus.ACTIVE) {
      apiError('CONSULTATION_NOT_ACTIVE', 'Консультация не активна', 409);
    }

    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId: userSub, deletedAt: null },
    });
    if (!method) {
      apiError('PAYMENT_METHOD_NOT_FOUND', 'Способ оплаты не найден', 404);
    }

    const existing = await this.prisma.payment.findUnique({
      where: { consultationId },
    });
    if (
      existing &&
      (existing.status === PaymentStatus.HELD ||
        existing.status === PaymentStatus.CAPTURED)
    ) {
      apiError('ALREADY_PAID', 'Консультация уже оплачена', 409);
    }

    const amountTiyn = consultation.priceTiyn;
    const commissionTiyn = Math.round(amountTiyn * COMMISSION_RATE);

    const payment = await this.upsertPending(
      consultationId,
      consultation.clientUserId,
      consultation.expertId,
      method!.id,
      amountTiyn,
      commissionTiyn,
    );

    const result = await this.provider.hold({
      idempotencyKey: `hold:${consultationId}`,
      token: method!.providerToken,
      amountTiyn,
    });

    if (result.status === 'declined') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failReason: result.declineReason ?? 'Банк отклонил операцию',
        },
      });
      await this.prisma.consultation.update({
        where: { id: consultationId },
        data: { paymentStatus: ConsultationPaymentStatus.FAILED },
      });

      await this.audit.log({
        actorType: 'user',
        actorId: userSub,
        entity: 'payment',
        entityId: payment.id,
        transition: 'payment.failed',
        payload: { consultationId, reason: result.declineReason },
      });

      this.events.emitToUser(
        consultation.clientUserId,
        'consultation.updated',
        {
          id: consultationId,
          paymentStatus: ConsultationPaymentStatus.FAILED,
        },
      );
      this.events.emitToExpert(consultation.expertId, 'consultation.updated', {
        id: consultationId,
        paymentStatus: ConsultationPaymentStatus.FAILED,
      });

      apiError(
        'PROVIDER_DECLINED',
        result.declineReason ?? 'Банк отклонил операцию',
        402,
      );
    }

    const now = this.clock.now();
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.HELD,
        providerHoldId: result.providerHoldId,
        holdCreatedAt: now,
      },
    });
    await this.prisma.consultation.update({
      where: { id: consultationId },
      data: { paymentStatus: ConsultationPaymentStatus.HELD },
    });

    await this.audit.log({
      actorType: 'user',
      actorId: userSub,
      entity: 'payment',
      entityId: payment.id,
      transition: 'payment.held',
      payload: { consultationId, providerHoldId: result.providerHoldId },
    });

    this.events.emitToUser(consultation.clientUserId, 'consultation.updated', {
      id: consultationId,
      paymentStatus: ConsultationPaymentStatus.HELD,
    });
    this.events.emitToExpert(consultation.expertId, 'consultation.updated', {
      id: consultationId,
      paymentStatus: ConsultationPaymentStatus.HELD,
    });

    return { status: PaymentStatus.HELD };
  }

  // upsert по consultationId (@unique): P2002 на create -> уже существует
  // (гонка/повтор), обновляем ту же строку в PENDING с новыми
  // paymentMethodId/amount/commission (повтор после FAILED — восстановление
  // с новой картой той же записью).
  private async upsertPending(
    consultationId: string,
    clientUserId: string,
    expertId: string,
    paymentMethodId: string,
    amountTiyn: number,
    commissionTiyn: number,
  ) {
    try {
      return await this.prisma.payment.create({
        data: {
          consultationId,
          clientUserId,
          expertId,
          paymentMethodId,
          amountTiyn,
          commissionTiyn,
          status: PaymentStatus.PENDING,
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        return this.prisma.payment.update({
          where: { consultationId },
          data: {
            paymentMethodId,
            amountTiyn,
            commissionTiyn,
            status: PaymentStatus.PENDING,
            failReason: null,
          },
        });
      }
      throw e;
    }
  }

  // GET /v1/consultations/:id/payment — только клиент-участник; эксперт
  // (или чужой) -> 404 CONSULTATION_NOT_FOUND (PII платежа клиента).
  async getStatus(
    consultationId: string,
    userSub: string,
  ): Promise<PaymentStatusDto> {
    const { role } = await this.consultations.resolveParticipant(
      consultationId,
      userSub,
    );
    if (role !== 'client') {
      apiError('CONSULTATION_NOT_FOUND', 'Консультация не найдена', 404);
    }

    const payment = await this.prisma.payment.findUnique({
      where: { consultationId },
    });
    if (!payment) {
      apiError('PAYMENT_NOT_FOUND', 'Платёж не найден', 404);
    }

    const method = await this.prisma.paymentMethod.findUnique({
      where: { id: payment!.paymentMethodId },
    });

    return {
      status: payment!.status,
      amountTiyn: payment!.amountTiyn,
      maskedPan: method?.maskedPan ?? '',
    };
  }
}
