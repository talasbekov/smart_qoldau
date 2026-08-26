import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { clientUser } from './utils/client-helpers';

// Своя полоса номеров, не пересекается с другими спеками.
const PH_C1 = '+77087100001';
const ALL_PHONES = [PH_C1];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    lastCode = match ? match[1] : '';
  }
}

let app: INestApplication;

function post(token: string, url: string) {
  return request(app.getHttpServer())
    .post(url)
    .set('Authorization', `Bearer ${token}`);
}
function get(token: string, url: string) {
  return request(app.getHttpServer())
    .get(url)
    .set('Authorization', `Bearer ${token}`);
}

const GOOD_CARD = {
  pan: '4111111111111111',
  expiry: '12/30',
  holderName: 'IVAN IVANOV',
};
const DECLINED_CARD = { ...GOOD_CARD, pan: '4000000000000002' };

describe('Premium: оформление, отмена, статус (e2e)', () => {
  let prisma: PrismaService;

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
      where: { entityId: { in: [...userIds, ...subs.map((s) => s.id)] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
  });

  beforeEach(() => cleanup());

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function clientWithCard(card = GOOD_CARD) {
    const cli = await clientUser(app, PH_C1, () => lastCode);
    const method = await post(cli.accessToken, '/v1/payment-methods')
      .send(card)
      .expect(201);
    return { ...cli, paymentMethodId: method.body.id as string };
  }

  it('оплата картой -> ACTIVE до конца периода, проводка в ledger', async () => {
    const cli = await clientWithCard();

    const before = await get(cli.accessToken, '/v1/premium').expect(200);
    expect(before.body.active).toBe(false);

    const res = await post(cli.accessToken, '/v1/premium/subscribe')
      .send({ plan: 'MONTH', paymentMethodId: cli.paymentMethodId })
      .expect(201);
    expect(res.body.active).toBe(true);
    expect(res.body.plan).toBe('MONTH');
    expect(new Date(res.body.currentPeriodEnd).getTime()).toBeGreaterThan(
      Date.now(),
    );

    const sub = await prisma.subscription.findFirstOrThrow({
      where: { userId: cli.userId },
    });
    const tx = await prisma.ledgerTransaction.findFirst({
      where: { kind: 'subscription_charge', refId: { startsWith: sub.id } },
      include: { entries: true },
    });
    expect(tx).not.toBeNull();
    // Деньги подписок идут на свой счёт: смешать их с комиссией — значит
    // сделать отчёт «сколько заработали на консультациях» ложью.
    const credit = tx!.entries.find(
      (e) => e.account === 'platform:subscription',
    );
    expect(credit!.creditTiyn).toBe(299_000);
  });

  it('повторная подписка при активной -> 409 SUBSCRIPTION_EXISTS', async () => {
    const cli = await clientWithCard();
    await post(cli.accessToken, '/v1/premium/subscribe')
      .send({ plan: 'MONTH', paymentMethodId: cli.paymentMethodId })
      .expect(201);

    const res = await post(cli.accessToken, '/v1/premium/subscribe')
      .send({ plan: 'YEAR', paymentMethodId: cli.paymentMethodId })
      .expect(409);
    expect(res.body.error.code).toBe('SUBSCRIPTION_EXISTS');
    expect(
      await prisma.subscription.count({ where: { userId: cli.userId } }),
    ).toBe(1);
  });

  it('отказ банка -> 402 PAYMENT_DECLINED, подписки нет', async () => {
    const cli = await clientWithCard(DECLINED_CARD);
    const res = await post(cli.accessToken, '/v1/premium/subscribe')
      .send({ plan: 'MONTH', paymentMethodId: cli.paymentMethodId })
      .expect(402);
    expect(res.body.error.code).toBe('PAYMENT_DECLINED');
    expect(
      await prisma.subscription.count({ where: { userId: cli.userId } }),
    ).toBe(0);
  });

  it('годовой тариф списывает 23 900 ₸ и даёт период длиннее месячного', async () => {
    const cli = await clientWithCard();
    const res = await post(cli.accessToken, '/v1/premium/subscribe')
      .send({ plan: 'YEAR', paymentMethodId: cli.paymentMethodId })
      .expect(201);
    expect(res.body.plan).toBe('YEAR');
    const sub = await prisma.subscription.findFirstOrThrow({
      where: { userId: cli.userId },
    });
    const tx = await prisma.ledgerTransaction.findFirstOrThrow({
      where: { kind: 'subscription_charge', refId: { startsWith: sub.id } },
      include: { entries: true },
    });
    expect(
      tx.entries.find((e) => e.account === 'platform:subscription')!.creditTiyn,
    ).toBe(2_390_000);
    const days =
      (sub.currentPeriodEnd.getTime() - sub.createdAt.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(365);
  });

  it('отмена: статус CANCELLED, доступ до конца периода (Р-09)', async () => {
    const cli = await clientWithCard();
    await post(cli.accessToken, '/v1/premium/subscribe')
      .send({ plan: 'MONTH', paymentMethodId: cli.paymentMethodId })
      .expect(201);

    await post(cli.accessToken, '/v1/premium/cancel').expect(200);
    const after = await get(cli.accessToken, '/v1/premium').expect(200);
    // Клиент заплатил за месяц — доступ до конца оплаченного периода, даже
    // если отменил на следующий день.
    expect(after.body.active).toBe(true);
    expect(after.body.cancelled).toBe(true);
  });

  it('две подписки одновременно: одна оформлена, вторая — доменный отказ', async () => {
    const cli = await clientWithCard();

    // Две вкладки, две кнопки «оформить». Обе проходят проверку «живой
    // подписки нет» — арбитраж обязан быть в базе, а не в проверке перед
    // списанием, иначе с карты уйдут две суммы.
    const responses = await Promise.all([
      post(cli.accessToken, '/v1/premium/subscribe').send({
        plan: 'MONTH',
        paymentMethodId: cli.paymentMethodId,
      }),
      post(cli.accessToken, '/v1/premium/subscribe').send({
        plan: 'MONTH',
        paymentMethodId: cli.paymentMethodId,
      }),
    ]);

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses[0]).toBe(201);
    expect(statuses[1]).toBe(409);
    const rejected = responses.find((r) => r.status !== 201)!;
    expect(rejected.body.error.code).toBe('SUBSCRIPTION_EXISTS');

    expect(
      await prisma.subscription.count({ where: { userId: cli.userId } }),
    ).toBe(1);
    // И ровно одно списание в учёте.
    const sub = await prisma.subscription.findFirstOrThrow({
      where: { userId: cli.userId },
    });
    expect(
      await prisma.ledgerTransaction.count({
        where: {
          kind: 'subscription_charge',
          refId: { startsWith: sub.id },
        },
      }),
    ).toBe(1);
  });

  it('отказ банка не оставляет за собой мёртвую подписку', async () => {
    const cli = await clientWithCard(DECLINED_CARD);
    await post(cli.accessToken, '/v1/premium/subscribe')
      .send({ plan: 'MONTH', paymentMethodId: cli.paymentMethodId })
      .expect(402);

    // Ни ACTIVE, ни любой другой живой: подписаться заново должно быть
    // можно сразу, другой картой.
    expect(
      await prisma.subscription.count({ where: { userId: cli.userId } }),
    ).toBe(0);
  });

  it('чужая карта не годится: 404 PAYMENT_METHOD_NOT_FOUND', async () => {
    const cli = await clientWithCard();
    const res = await post(cli.accessToken, '/v1/premium/subscribe')
      .send({
        plan: 'MONTH',
        paymentMethodId: '00000000-0000-0000-0000-000000000000',
      })
      .expect(404);
    expect(res.body.error.code).toBe('PAYMENT_METHOD_NOT_FOUND');
  });

  it('без токена -> 401', async () => {
    await request(app.getHttpServer()).get('/v1/premium').expect(401);
  });
});
