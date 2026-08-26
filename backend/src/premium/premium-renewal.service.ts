import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Subscription, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import {
  ACC_ACQUIRER,
  ACC_SUBSCRIPTION,
  LedgerService,
} from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentProviderPort } from '../payments/provider/payment-provider.port';
import {
  MAX_RENEW_ATTEMPTS,
  PERIOD_DAYS,
  PREMIUM_PRICES,
  RENEW_WINDOW_HOURS,
} from './premium.constants';
import { addDays, periodRef } from './premium.service';

// Раз в минуту: периоды измеряются днями, точность до минуты избыточна, а
// запрос по индексу (status, current_period_end) стоит копейки.
const TICK_MS = 60_000;
const HOUR_MS = 3_600_000;

@Injectable()
export class PremiumRenewalService {
  private readonly logger = new Logger(PremiumRenewalService.name);

  constructor(
    private prisma: PrismaService,
    private clock: ClockService,
    private audit: AuditService,
    private ledger: LedgerService,
    private notifications: NotificationsService,
    private provider: PaymentProviderPort,
  ) {}

  @Interval(TICK_MS)
  async tick(): Promise<void> {
    const now = this.clock.now();
    const due = await this.prisma.subscription.findMany({
      where: {
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.GRACE,
            SubscriptionStatus.CANCELLED,
          ],
        },
        currentPeriodEnd: { lte: now },
      },
    });

    for (const sub of due) {
      try {
        // Отменённую подписку продлевать деньгами клиента нельзя: он
        // попрощался, доступ дожил до конца оплаченного периода — всё.
        if (sub.status === SubscriptionStatus.CANCELLED) {
          await this.expire(sub, now, false);
          continue;
        }

        // Окно ретраев исчерпано временем или попытками — даунгрейд (Р-09).
        const windowOver =
          sub.firstFailedAt !== null &&
          now.getTime() - sub.firstFailedAt.getTime() >=
            RENEW_WINDOW_HOURS * HOUR_MS;
        if (sub.renewAttempts >= MAX_RENEW_ATTEMPTS || windowOver) {
          await this.expire(sub, now, true);
          continue;
        }

        await this.attemptCharge(sub, now);
      } catch (e) {
        // Падение на одной подписке не должно останавливать остальные — тот
        // же принцип, что в sweep'ах офферов и плановых консультаций.
        this.logger.error(
          `продление подписки ${sub.id} упало: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }
  }

  private async attemptCharge(sub: Subscription, now: Date): Promise<void> {
    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: sub.paymentMethodId, deletedAt: null },
    });
    // Карту отвязали — для клиента это ровно тот же случай, что отказ банка:
    // деньги не списались, начинается grace, а не молчаливая потеря доступа.
    const charge = method
      ? await this.provider.charge({
          // Ключ включает период: ретрай ОДНОЙ попытки схлопнется у
          // провайдера, а следующий месяц спишется отдельно.
          idempotencyKey: `sub:${sub.id}:${sub.currentPeriodEnd.getTime()}`,
          token: method.providerToken,
          amountTiyn: PREMIUM_PRICES[sub.plan],
        })
      : ({ status: 'declined', providerChargeId: '' } as const);

    if (charge.status === 'declined') {
      await this.markFailed(sub, now);
      return;
    }

    const amountTiyn = PREMIUM_PRICES[sub.plan];
    const nextEnd = addDays(sub.currentPeriodEnd, PERIOD_DAYS[sub.plan]);
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: nextEnd,
        renewAttempts: 0,
        firstFailedAt: null,
      },
    });
    await this.ledger.post('subscription_charge', periodRef(sub.id, nextEnd), [
      { account: ACC_ACQUIRER, debitTiyn: amountTiyn },
      { account: ACC_SUBSCRIPTION, creditTiyn: amountTiyn },
    ]);
    await this.audit.log({
      actorType: 'system',
      entity: 'subscription',
      entityId: sub.id,
      transition: 'subscription.renewed',
      payload: { plan: sub.plan, amountTiyn },
    });
    await this.notifications.dispatch(sub.userId, 'premium.renewed', {
      amountTenge: Math.round(amountTiyn / 100),
    });
  }

  private async markFailed(sub: Subscription, now: Date): Promise<void> {
    const firstFailure = sub.firstFailedAt === null;
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.GRACE,
        renewAttempts: { increment: 1 },
        firstFailedAt: sub.firstFailedAt ?? now,
      },
    });
    await this.audit.log({
      actorType: 'system',
      entity: 'subscription',
      entityId: sub.id,
      transition: 'subscription.renew_failed',
      payload: { attempt: sub.renewAttempts + 1 },
    });
    // Предупреждаем один раз: три одинаковых пуша за трое суток клиент
    // прочитает как поломку, а не как заботу.
    if (firstFailure) {
      await this.notifications.dispatch(sub.userId, 'premium.renew_failed', {});
    }
  }

  private async expire(
    sub: Subscription,
    now: Date,
    notify: boolean,
  ): Promise<void> {
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.EXPIRED },
    });
    await this.audit.log({
      actorType: 'system',
      entity: 'subscription',
      entityId: sub.id,
      transition: 'subscription.expired',
      payload: {
        reason:
          sub.status === SubscriptionStatus.CANCELLED
            ? 'cancelled_by_user'
            : 'renew_failed',
        at: now.toISOString(),
      },
    });
    // Клиенту, который сам отменил подписку, сообщать «подписка завершена»
    // нечего — он это и так знает.
    if (notify) {
      await this.notifications.dispatch(sub.userId, 'premium.downgraded', {});
    }
  }
}
