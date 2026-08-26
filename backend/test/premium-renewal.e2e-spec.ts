import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClockService } from '../src/common/clock/clock.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { PremiumService } from '../src/premium/premium.service';
import { PremiumRenewalService } from '../src/premium/premium-renewal.service';
import { createApp } from './utils/create-app';
import { clientUser } from './utils/client-helpers';

// Своя полоса номеров.
const PH_C1 = '+77087200001';
const PH_C2 = '+77087200002';
const PH_C3 = '+77087200003';
const ALL_PHONES = [PH_C1, PH_C2, PH_C3];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    lastCode = match ? match[1] : '';
  }
}

// Виртуальные часы: окно ретраев Р-09 — 72 часа, ждать их по-настоящему
// нечем.
const fakeClock = {
  current: new Date('2026-08-26T05:00:00Z'),
  now(): Date {
    return new Date(this.current);
  },
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  },
};

const HOUR = 3_600_000;

let app: INestApplication;

function post(token: string, url: string) {
  return request(app.getHttpServer())
    .post(url)
    .set('Authorization', `Bearer ${token}`);
}

const GOOD_CARD = {
  pan: '4111111111111111',
  expiry: '12/30',
  holderName: 'IVAN IVANOV',
};
const DECLINED_CARD = { ...GOOD_CARD, pan: '4000000000000002' };

describe('Premium: автопродление, grace и даунгрейд (Р-09, e2e)', () => {
  let prisma: PrismaService;
  let premium: PremiumService;
  let renewal: PremiumRenewalService;

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const subs = await prisma.subscription.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const refIds = subs.map((s) => s.id);
    // refId проводки — «подписка:конец периода», поэтому чистим по префиксу.
    const txs = subs.length
      ? await prisma.ledgerTransaction.findMany({
          where: {
            kind: 'subscription_charge',
            OR: subs.map((s) => ({ refId: { startsWith: s.id } })),
          },
          select: { id: true },
        })
      : [];
    const txIds = txs.map((t) => t.id);
    await prisma.ledgerEntry.deleteMany({
      where: { transactionId: { in: txIds } },
    });
    await prisma.ledgerTransaction.deleteMany({ where: { id: { in: txIds } } });
    await prisma.notificationOutbox.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.subscription.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.paymentMethod.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...userIds, ...refIds] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider)
        .overrideProvider(ClockService)
        .useValue(fakeClock),
    );
    prisma = app.get(PrismaService);
    premium = app.get(PremiumService);
    renewal = app.get(PremiumRenewalService);
  });

  beforeEach(async () => {
    fakeClock.current = new Date('2026-08-26T05:00:00Z');
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  /// Подписка всегда оформляется рабочей картой — отказной оформить её
  /// нельзя. `breakCard` воспроизводит жизненный сценарий: через месяц
  /// карта перевыпущена или заблокирована, и продление упирается в отказ.
  async function activeSubscription(phone: string, breakCard = false) {
    const client = await clientUser(app, phone, () => lastCode);
    const method = await post(client.accessToken, '/v1/payment-methods')
      .send(GOOD_CARD)
      .expect(201);
    await post(client.accessToken, '/v1/premium/subscribe')
      .send({ plan: 'MONTH', paymentMethodId: method.body.id })
      .expect(201);
    if (breakCard) {
      const bad = await post(client.accessToken, '/v1/payment-methods')
        .send(DECLINED_CARD)
        .expect(201);
      await prisma.subscription.updateMany({
        where: { userId: client.userId },
        data: { paymentMethodId: bad.body.id },
      });
    }
    const sub = await prisma.subscription.findFirstOrThrow({
      where: { userId: client.userId },
    });
    return { client, sub };
  }

  function notificationsOf(userId: string, type: string) {
    return prisma.notificationOutbox.findMany({ where: { userId, type } });
  }

  function reload(id: string) {
    return prisma.subscription.findUniqueOrThrow({ where: { id } });
  }

  it('успешное продление: период сдвигается, попытки сброшены, уведомление ушло', async () => {
    const { client, sub } = await activeSubscription(PH_C1);
    fakeClock.current = new Date(sub.currentPeriodEnd.getTime() + 1000);

    await renewal.tick();

    const fresh = await reload(sub.id);
    expect(fresh.status).toBe('ACTIVE');
    expect(fresh.currentPeriodEnd.getTime()).toBeGreaterThan(
      sub.currentPeriodEnd.getTime(),
    );
    expect(fresh.renewAttempts).toBe(0);
    expect(fresh.firstFailedAt).toBeNull();
    expect(
      await notificationsOf(client.userId, 'premium.renewed'),
    ).toHaveLength(1);
    // Каждый период — своя проводка: первичная оплата плюс продление.
    expect(
      await prisma.ledgerTransaction.count({
        where: { kind: 'subscription_charge', refId: { startsWith: sub.id } },
      }),
    ).toBe(2);
  });

  it('отказ банка: GRACE, доступ сохраняется, 3 попытки за 72 часа', async () => {
    const { client, sub } = await activeSubscription(PH_C2, true);
    fakeClock.current = new Date(sub.currentPeriodEnd.getTime() + 1000);

    await renewal.tick(); // попытка 1
    let fresh = await reload(sub.id);
    expect(fresh.status).toBe('GRACE');
    expect(fresh.renewAttempts).toBe(1);
    expect(fresh.firstFailedAt).not.toBeNull();
    // Доступ в grace сохраняется — это и есть смысл Р-09.
    expect(await premium.isPremiumAt(client.userId, fakeClock.now())).toBe(
      true,
    );

    fakeClock.advance(24 * HOUR);
    await renewal.tick(); // попытка 2
    fakeClock.advance(24 * HOUR);
    await renewal.tick(); // попытка 3
    fresh = await reload(sub.id);
    expect(fresh.renewAttempts).toBe(3);
    expect(fresh.status).toBe('GRACE');
    // Три пуша об одном и том же клиенту не нужны — предупреждаем один раз.
    expect(
      await notificationsOf(client.userId, 'premium.renew_failed'),
    ).toHaveLength(1);
  });

  it('после 72 часов и 3 попыток -> EXPIRED, доступа нет, клиент уведомлён', async () => {
    const { client, sub } = await activeSubscription(PH_C2, true);
    fakeClock.current = new Date(sub.currentPeriodEnd.getTime() + 1000);

    await renewal.tick();
    fakeClock.advance(24 * HOUR);
    await renewal.tick();
    fakeClock.advance(24 * HOUR);
    await renewal.tick();

    fakeClock.advance(25 * HOUR); // суммарно > 72 ч от первой неудачи
    await renewal.tick();

    const fresh = await reload(sub.id);
    expect(fresh.status).toBe('EXPIRED');
    expect(await premium.isPremiumAt(client.userId, fakeClock.now())).toBe(
      false,
    );
    expect(
      await notificationsOf(client.userId, 'premium.downgraded'),
    ).toHaveLength(1);
  });

  it('отменённая подписка не продлевается: по концу периода -> EXPIRED без списания', async () => {
    const { client, sub } = await activeSubscription(PH_C3);
    await post(client.accessToken, '/v1/premium/cancel').expect(200);
    fakeClock.current = new Date(sub.currentPeriodEnd.getTime() + 1000);

    await renewal.tick();

    const fresh = await reload(sub.id);
    expect(fresh.status).toBe('EXPIRED');
    // Списаний ровно одно — первичное. Отменённую подписку продлевать
    // деньгами клиента нельзя ни при каких обстоятельствах.
    expect(
      await prisma.ledgerTransaction.count({
        where: { kind: 'subscription_charge', refId: { startsWith: sub.id } },
      }),
    ).toBe(1);
    // Клиент сам отменил — сообщать ему «подписка завершена» нечего.
    expect(
      await notificationsOf(client.userId, 'premium.downgraded'),
    ).toHaveLength(0);
  });

  it('живая подписка до конца периода не трогается', async () => {
    const { sub } = await activeSubscription(PH_C1);
    fakeClock.advance(HOUR);

    await renewal.tick();

    const fresh = await reload(sub.id);
    expect(fresh.currentPeriodEnd.getTime()).toBe(
      sub.currentPeriodEnd.getTime(),
    );
    expect(
      await prisma.ledgerTransaction.count({
        where: { kind: 'subscription_charge', refId: { startsWith: sub.id } },
      }),
    ).toBe(1);
  });
});
