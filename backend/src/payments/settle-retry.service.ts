import { Injectable, Logger } from '@nestjs/common';
import {
  ConsultationPaymentStatus,
  ConsultationStatus,
  PaymentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { EventsService } from '../ws/events.service';
import { PaymentsService } from './payments.service';
import { PaymentProviderPort } from './provider/payment-provider.port';

const SETTLE_MAX_ATTEMPTS = 10;
// Интервал между ретраями settle одной записи: sweep тикает каждую секунду,
// и без интервала 10-секундный сбой провайдера навсегда исчерпал бы лимит
// попыток (10 × 60с даёт ~10 минут терпимости к сбою).
const SETTLE_RETRY_INTERVAL_MS = 60_000;
const REHOLD_AGE_MS = 5 * 24 * 60 * 60 * 1000; // 5 дней
// Ограничение партии за тик: «застрявших» платежей единицы, а сотни — уже
// признак инцидента, где важнее не зашибить провайдера лавиной ретраев.
const SWEEP_BATCH = 100;

// Sweep денег (E5, задача 6): два независимых прохода по «застрявшим»
// платежам, вызывается из OfferTimerService.sweep() 6-м шагом (см. паттерн
// no-show, E4 задача 5). Каждый проход изолирован в своём try/catch на
// уровне вызывающего (OfferTimerService.logStepError) — сбой одного не
// блокирует другой.
//
// (а) Ретраи settle: Payment HELD, но консультация уже COMPLETED/CANCELLED
//     (исход зафиксирован) — расхождение возможно только если предыдущий
//     вызов settle() упал ПОСЛЕ успешного provider.capture()/void(), но ДО
//     нашей БД-транзакции (сеть/процесс оборвался). Повторный settle()
//     безопасен: мок-провайдер дедуплицирует capture/void по
//     idempotencyKey (Task 5), так что повтор либо доходит до конца
//     впервые, либо мгновенно получает тот же успешный результат по ключу.
//     После SETTLE_MAX_ATTEMPTS неудачных попыток — audit
//     payment.settle_exhausted, дальше только ручной разбор (sweep
//     перестаёт трогать эту запись, чтобы не спамить провайдера/логи).
//
// (б) Перехолд Р-01: Payment HELD, консультация ещё ACTIVE (исход не
//     наступил), а holdCreatedAt старше 5 дней — банковские холды не живут
//     вечно, нужно void старый + hold новый на ту же карту, чтобы деньги
//     клиента оставались зарезервированы до исхода. idempotencyKey нового
//     hold — 'rehold:{paymentId}:{reholdCount+1}': уникален для КАЖДОЙ
//     попытки перехолда данного платежа, поэтому повторный sweep ПОСЛЕ
//     успешного перехолда (holdCreatedAt уже обновлён на now, условие
//     «>5 дней» больше не выполняется) естественно идемпотентен — не через
//     дедуп по ключу, а потому что запись больше не попадает в выборку.
//     Отказ банка на новом hold -> Payment FAILED, paymentStatus FAILED,
//     audit payment.rehold_failed (клиент платит заново — Task 4 разрешает
//     pay() после FAILED, upsertPending поднимает ту же Payment-строку).
@Injectable()
export class SettleRetryService {
  private readonly logger = new Logger(SettleRetryService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private clock: ClockService,
    private events: EventsService,
    private payments: PaymentsService,
    private provider: PaymentProviderPort,
  ) {}

  // Возвращает число обработанных записей (оба прохода суммарно) — для
  // единообразия с OfferTimerService.sweepExpiredOffers().
  async sweep(): Promise<number> {
    let processed = 0;
    processed += await this.sweepSettleRetries();
    processed += await this.sweepRehold();
    return processed;
  }

  // Payment не хранит relation-поле к Consultation в schema.prisma (только
  // скалярный consultationId) — join делаем вручную, НАЧИНАЯ с платежей:
  // HELD-кандидатов единицы и они индексированы по статусу, а выборка «всех
  // завершённых консультаций» в IN-фильтр росла бы без предела и на большом
  // объёме валила бы запрос каждый тик.
  private async sweepSettleRetries(): Promise<number> {
    const retryCutoff = new Date(
      this.clock.now().getTime() - SETTLE_RETRY_INTERVAL_MS,
    );
    const heldPayments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.HELD,
        settleAttempts: { lt: SETTLE_MAX_ATTEMPTS },
        OR: [
          { lastSettleAttemptAt: null },
          { lastSettleAttemptAt: { lte: retryCutoff } },
        ],
      },
      take: SWEEP_BATCH,
    });
    if (heldPayments.length === 0) return 0;

    const doneIds = new Set(
      (
        await this.prisma.consultation.findMany({
          where: {
            id: { in: heldPayments.map((p) => p.consultationId) },
            status: {
              in: [ConsultationStatus.COMPLETED, ConsultationStatus.CANCELLED],
            },
          },
          select: { id: true },
        })
      ).map((c) => c.id),
    );
    const candidates = heldPayments.filter((p) =>
      doneIds.has(p.consultationId),
    );

    let processed = 0;
    for (const payment of candidates) {
      processed++;
      try {
        await this.payments.settle(payment.consultationId);
      } catch (e) {
        // Провайдер/сеть всё ещё недоступны — фиксируем попытку и, при
        // исчерпании лимита, оставляем audit-хлебную крошку для ручного
        // разбора. Сам Payment остаётся HELD — settle() снова попробует
        // в следующем sweep, пока не исчерпан лимит попыток.
        await this.recordFailedAttempt(payment.id, payment.consultationId);
        this.logger.warn(
          `settle retry failed for payment ${payment.id} (consultation ${payment.consultationId}): ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
        continue;
      }

      // settle() либо перевёл платёж в CAPTURED/VOIDED, либо (при повторном
      // сбое ПОСЛЕ успешного provider-вызова, но до нашей БД-транзакции)
      // всё ещё HELD — в обоих случаях учитываем попытку.
      const after = await this.prisma.payment.findUnique({
        where: { id: payment.id },
        select: { status: true },
      });
      if (after?.status === PaymentStatus.HELD) {
        await this.recordFailedAttempt(payment.id, payment.consultationId);
      }
    }
    return processed;
  }

  private async recordFailedAttempt(
    paymentId: string,
    consultationId: string,
  ): Promise<void> {
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        settleAttempts: { increment: 1 },
        lastSettleAttemptAt: this.clock.now(),
      },
    });
    if (updated.settleAttempts >= SETTLE_MAX_ATTEMPTS) {
      await this.audit.log({
        actorType: 'system',
        entity: 'payment',
        entityId: paymentId,
        transition: 'payment.settle_exhausted',
        payload: { consultationId, settleAttempts: updated.settleAttempts },
      });
    }
  }

  private async sweepRehold(): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - REHOLD_AGE_MS);

    // Как и в sweepSettleRetries: сперва узкая индексированная выборка
    // платежей (status, holdCreatedAt), затем точечная проверка их
    // консультаций — не наоборот.
    const agedPayments = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.HELD,
        holdCreatedAt: { lte: cutoff },
      },
      take: SWEEP_BATCH,
    });
    if (agedPayments.length === 0) return 0;

    const activeIds = new Set(
      (
        await this.prisma.consultation.findMany({
          where: {
            id: { in: agedPayments.map((p) => p.consultationId) },
            status: ConsultationStatus.ACTIVE,
          },
          select: { id: true },
        })
      ).map((c) => c.id),
    );
    const candidates = agedPayments.filter((p) =>
      activeIds.has(p.consultationId),
    );

    let processed = 0;
    for (const payment of candidates) {
      processed++;
      try {
        await this.reholdOne(payment);
      } catch (e) {
        this.logger.error(
          `rehold failed for payment ${payment.id}: ${
            e instanceof Error ? e.message : String(e)
          }`,
          e instanceof Error ? e.stack : undefined,
        );
      }
    }
    return processed;
  }

  private async reholdOne(payment: {
    id: string;
    consultationId: string;
    paymentMethodId: string;
    amountTiyn: number;
    providerHoldId: string | null;
    reholdCount: number;
    clientUserId: string;
    expertId: string;
  }): Promise<void> {
    // Только живая карта: soft-deleted способ оплаты — отозванное согласие
    // клиента, новый холд на него ставить нельзя (deletedAt-фильтр, как в
    // pay()).
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: payment.paymentMethodId, deletedAt: null },
    });
    if (!method) {
      await this.failRehold(payment, 'Способ оплаты недоступен');
      return;
    }

    const attemptNumber = payment.reholdCount + 1;

    await this.provider.void({
      idempotencyKey: `void:rehold:${payment.id}:${attemptNumber}`,
      providerHoldId: payment.providerHoldId!,
    });

    const result = await this.provider.hold({
      idempotencyKey: `rehold:${payment.id}:${attemptNumber}`,
      token: method.providerToken,
      amountTiyn: payment.amountTiyn,
    });

    if (result.status === 'declined') {
      await this.failRehold(
        payment,
        result.declineReason ?? 'Банк отклонил операцию',
      );
      return;
    }

    const now = this.clock.now();
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerHoldId: result.providerHoldId,
        holdCreatedAt: now,
        reholdCount: attemptNumber,
      },
    });

    await this.audit.log({
      actorType: 'system',
      entity: 'payment',
      entityId: payment.id,
      transition: 'payment.reheld',
      payload: {
        consultationId: payment.consultationId,
        reholdCount: attemptNumber,
        providerHoldId: result.providerHoldId,
      },
    });
  }

  private async failRehold(
    payment: {
      id: string;
      consultationId: string;
      clientUserId: string;
      expertId: string;
    },
    reason: string,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED, failReason: reason },
      }),
      this.prisma.consultation.update({
        where: { id: payment.consultationId },
        data: { paymentStatus: ConsultationPaymentStatus.FAILED },
      }),
    ]);

    await this.audit.log({
      actorType: 'system',
      entity: 'payment',
      entityId: payment.id,
      transition: 'payment.rehold_failed',
      payload: { consultationId: payment.consultationId, reason },
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
