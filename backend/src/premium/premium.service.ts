import { Injectable } from '@nestjs/common';
import {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { apiError } from '../common/filters/app-exception.filter';
import {
  ACC_ACQUIRER,
  ACC_SUBSCRIPTION,
  LedgerService,
} from '../ledger/ledger.service';
import { PaymentProviderPort } from '../payments/provider/payment-provider.port';
import { PREMIUM_PRICES, PERIOD_DAYS } from './premium.constants';
import { PremiumStatusDto } from './dto/premium-status.dto';

// Статусы, в которых подписка считается живой: занимает частичный уникальный
// индекс и мешает оформить вторую. EXPIRED сюда не входит — после истечения
// можно подписаться заново.
export const LIVE_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.GRACE,
  SubscriptionStatus.CANCELLED,
];

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

/// Ссылка проводки — «подписка + оплаченный период», а не подписка целиком.
/// LedgerService идемпотентен по (kind, refId): с refId = id подписки второе
/// списание за следующий месяц молча вернуло бы проводку первого, и деньги
/// продлений исчезли бы из учёта. С периодом в ключе повтор ОДНОГО периода
/// (ретрай после падения) по-прежнему схлопывается — ровно это и нужно.
export function periodRef(subscriptionId: string, periodEnd: Date): string {
  return `${subscriptionId}:${periodEnd.getTime()}`;
}

@Injectable()
export class PremiumService {
  constructor(
    private prisma: PrismaService,
    private clock: ClockService,
    private audit: AuditService,
    private ledger: LedgerService,
    private provider: PaymentProviderPort,
  ) {}

  async subscribe(
    userId: string,
    plan: SubscriptionPlan,
    paymentMethodId: string,
  ): Promise<PremiumStatusDto> {
    const live = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: LIVE_STATUSES } },
    });
    if (live) {
      apiError('SUBSCRIPTION_EXISTS', 'Подписка уже оформлена', 409);
    }

    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId, deletedAt: null },
    });
    if (!method) {
      apiError('PAYMENT_METHOD_NOT_FOUND', 'Карта не найдена', 404);
    }

    const amountTiyn = PREMIUM_PRICES[plan];
    const now = this.clock.now();
    // Ключ идемпотентности включает момент списания: дубль запроса в ту же
    // секунду провайдер схлопнет, а продление через месяц — нет.
    const charge = await this.provider.charge({
      idempotencyKey: `sub:${userId}:${now.getTime()}`,
      token: method.providerToken,
      amountTiyn,
    });
    if (charge.status === 'declined') {
      apiError(
        'PAYMENT_DECLINED',
        charge.declineReason ?? 'Банк отклонил оплату',
        402,
      );
    }

    const sub = await this.prisma.subscription.create({
      data: {
        userId,
        plan,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: addDays(now, PERIOD_DAYS[plan]),
        paymentMethodId,
      },
    });
    // Эксперты в подписочных деньгах не участвуют вообще — в проводке только
    // эквайер и счёт подписок.
    await this.ledger.post(
      'subscription_charge',
      periodRef(sub.id, sub.currentPeriodEnd),
      [
        { account: ACC_ACQUIRER, debitTiyn: amountTiyn },
        { account: ACC_SUBSCRIPTION, creditTiyn: amountTiyn },
      ],
    );
    await this.audit.log({
      actorType: 'user',
      actorId: userId,
      entity: 'subscription',
      entityId: sub.id,
      transition: 'subscription.created',
      payload: { plan, amountTiyn },
    });
    return this.toDto(sub, now);
  }

  async cancel(userId: string): Promise<PremiumStatusDto> {
    const now = this.clock.now();
    const sub = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.GRACE] },
      },
    });
    if (!sub) {
      apiError('SUBSCRIPTION_NOT_FOUND', 'Активной подписки нет', 404);
    }

    // Период не трогаем: клиент заплатил за него, доступ остаётся до конца
    // (Р-09). Возврата за неиспользованный остаток нет — такого решения в
    // документах не принято.
    const cancelled = await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.CANCELLED, cancelledAt: now },
    });
    await this.audit.log({
      actorType: 'user',
      actorId: userId,
      entity: 'subscription',
      entityId: sub.id,
      transition: 'subscription.cancelled',
      payload: { currentPeriodEnd: cancelled.currentPeriodEnd.toISOString() },
    });
    return this.toDto(cancelled, now);
  }

  async status(userId: string): Promise<PremiumStatusDto> {
    const now = this.clock.now();
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: { in: LIVE_STATUSES } },
    });
    if (!sub) {
      return {
        active: false,
        plan: null,
        currentPeriodEnd: null,
        cancelled: false,
        inGrace: false,
      };
    }
    return this.toDto(sub, now);
  }

  /// Доступ есть, пока не кончился оплаченный период — даже если подписка
  /// отменена (Р-09).
  ///
  /// GRACE — отдельный случай: период там УЖЕ истёк, деньги за следующий не
  /// списались, и по дате доступа быть не должно. Но смысл grace ровно в
  /// том, чтобы человек не лишился Premium из-за перевыпущенной карты, пока
  /// идут ретраи; закрывает доступ sweep, переводя подписку в EXPIRED по
  /// исчерпании 72 часов или трёх попыток.
  async isPremiumAt(userId: string, at: Date): Promise<boolean> {
    const sub = await this.prisma.subscription.findFirst({
      where: {
        userId,
        OR: [
          { status: { in: LIVE_STATUSES }, currentPeriodEnd: { gt: at } },
          { status: SubscriptionStatus.GRACE },
        ],
      },
      select: { id: true },
    });
    return sub !== null;
  }

  private toDto(sub: Subscription, now: Date): PremiumStatusDto {
    return {
      // active обязан совпадать с фактическим доступом (isPremiumAt), иначе
      // экран показывает «Базовый», а скидка на консультацию всё ещё даётся.
      active:
        sub.currentPeriodEnd.getTime() > now.getTime() ||
        sub.status === SubscriptionStatus.GRACE,
      plan: sub.plan,
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      cancelled: sub.status === SubscriptionStatus.CANCELLED,
      inGrace: sub.status === SubscriptionStatus.GRACE,
    };
  }
}
