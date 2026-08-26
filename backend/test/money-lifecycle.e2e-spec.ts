import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHmac } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { ClockService } from '../src/common/clock/clock.service';
import {
  ACC_ACQUIRER,
  ACC_COMMISSION,
  ACC_PAYOUT_PENDING,
  ACC_PAYOUT_SENT,
  LedgerService,
  expertAccount,
} from '../src/ledger/ledger.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { OfferTimerService } from '../src/requests/offer-timer.service';
import { createApp } from './utils/create-app';
import { acceptingExpert as acceptingExpertHelper } from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Номера спека задачи 9 (E5, сквозной цикл), не пересекаются с другими.
const PH_E1 = '+77092000001';
const PH_E2 = '+77092000002';
const PH_C1 = '+77092000091';
const PH_C2 = '+77092000092';
const ALL_PHONES = [PH_E1, PH_E2, PH_C1, PH_C2];

const VISA_PAN = '4111111111111111';
const PAYOUT_WEBHOOK_SECRET =
  'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1';

// Цена 15 000 ₸: 85% = 1 275 000 тиын >= минимума вывода 10 000 ₸ — прямой
// цикл укладывается в одну консультацию (критерий ТЗ §11.2 на моке).
const PRICE_TIYN = 1_500_000;
const COMMISSION_TIYN = 225_000; // 15%
const NET_TIYN = PRICE_TIYN - COMMISSION_TIYN; // 1 275 000
const PAYOUT_TIYN = 1_000_000; // 10 000 ₸

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    lastCode = match ? match[1] : '';
  }
}

// Виртуальные часы (паттерн payments-sweep): перехолд >5 дней без ожидания.
const fakeClock = {
  current: new Date('2026-08-20T05:00:00Z'),
  now(): Date {
    return new Date(this.current);
  },
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  },
};

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

function signPayoutWebhook(body: object): string {
  return createHmac('sha256', PAYOUT_WEBHOOK_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');
}

describe('Сквозной e2e денежного цикла (E5, задача 9, ТЗ §11.2)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  let ledger: LedgerService;
  let timer: OfferTimerService;
  const registeredExpertIds: string[] = [];

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const experts = await prisma.expert.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const expertIds = experts.map((e) => e.id);
    if (registeredExpertIds.length) {
      await redis.srem('experts:available', ...registeredExpertIds);
      await redis.hdel('experts:lastseen', ...registeredExpertIds);
    }
    if (userIds.length) {
      await redis.del(...userIds.map((id) => `abuse:client:${id}`));
    }

    const payouts = await prisma.payout.findMany({
      where: { expertId: { in: expertIds } },
      select: { id: true },
    });
    const payoutIds = payouts.map((p) => p.id);
    const payments = await prisma.payment.findMany({
      where: {
        OR: [
          { expertId: { in: expertIds } },
          { clientUserId: { in: userIds } },
        ],
      },
      select: { id: true },
    });
    const paymentIds = payments.map((p) => p.id);

    // Только записи СВОИХ проводок. Раньше чистились все записи на общих
    // счетах (эквайер, комиссия, выплаты) — то есть спек сносил половинки
    // чужих проводок, включая подписочные, оставляя их несбалансированными.
    await prisma.ledgerEntry.deleteMany({
      where: {
        transaction: {
          OR: [
            { kind: 'capture', refId: { in: paymentIds } },
            {
              kind: { in: ['payout_reserve', 'payout_sent', 'payout_reject'] },
              refId: { in: payoutIds },
            },
          ],
        },
      },
    });
    await prisma.ledgerTransaction.deleteMany({
      where: {
        OR: [
          { kind: 'capture', refId: { in: paymentIds } },
          {
            kind: { in: ['payout_reserve', 'payout_sent', 'payout_reject'] },
            refId: { in: payoutIds },
          },
        ],
      },
    });
    await prisma.providerEvent.deleteMany({
      where: { providerEventId: { startsWith: 'evt-money-e2e-' } },
    });
    await prisma.payout.deleteMany({ where: { id: { in: payoutIds } } });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entity: 'request' },
          { entity: 'offer' },
          { entity: 'consultation' },
          { entity: 'payment' },
          { entity: 'payout' },
          { entity: 'expert', entityId: { in: expertIds } },
        ],
      },
    });
    await prisma.payment.deleteMany({
      where: { id: { in: paymentIds } },
    });
    await prisma.consultation.deleteMany({
      where: {
        OR: [
          { expertId: { in: expertIds } },
          { clientUserId: { in: userIds } },
        ],
      },
    });
    await prisma.requestCandidate.deleteMany({
      where: {
        OR: [
          { expertId: { in: expertIds } },
          { request: { clientUserId: { in: userIds } } },
        ],
      },
    });
    await prisma.request.deleteMany({
      where: { clientUserId: { in: userIds } },
    });
    await prisma.paymentMethod.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.expertScheduleDay.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expertDocument.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expertTopic.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expert.deleteMany({ where: { id: { in: expertIds } } });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...userIds, ...expertIds] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    registeredExpertIds.length = 0;

    const keys = [
      ...(await redis.keys('mockpay:*')),
      ...(await redis.keys('mockpayout:*')),
    ];
    if (keys.length) await redis.del(...keys);
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
    redis = app.get(RedisService);
    ledger = app.get(LedgerService);
    timer = app.get(OfferTimerService);
  });

  // Базовые балансы ОБЩИХ счетов на начало теста. Счёт эксперта
  // принадлежит спеку целиком, а эквайер, комиссия и выплаты общие для
  // всей базы — по ним проверяется движение за сценарий, а не абсолютный
  // итог. Раньше спек добивался абсолютных чисел тем, что вычищал эти
  // счета целиком, снося половинки чужих проводок.
  let acquirerBefore = 0;
  let commissionBefore = 0;
  let payoutPendingBefore = 0;
  let payoutSentBefore = 0;

  beforeEach(async () => {
    fakeClock.current = new Date('2026-08-20T05:00:00Z');
    await cleanup();
    acquirerBefore = await ledger.balanceTiyn(ACC_ACQUIRER);
    commissionBefore = await ledger.balanceTiyn(ACC_COMMISSION);
    payoutPendingBefore = await ledger.balanceTiyn(ACC_PAYOUT_PENDING);
    payoutSentBefore = await ledger.balanceTiyn(ACC_PAYOUT_SENT);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function acceptingExpert(phone: string) {
    const result = await acceptingExpertHelper(app, phone, () => lastCode);
    registeredExpertIds.push(result.expertId);
    return result;
  }

  async function clientUser(phone: string) {
    return clientUserHelper(app, phone, () => lastCode);
  }

  async function addCard(accessToken: string) {
    const res = await post(accessToken, '/v1/payment-methods')
      .send({ pan: VISA_PAN, expiry: '12/28', holderName: 'Ivan Petrov' })
      .expect(201);
    return res.body.id as string;
  }

  async function matchClientToExpert(
    cli: { accessToken: string },
    exp: { accessToken: string; expertId: string },
    expertId?: string,
  ) {
    await post(cli.accessToken, '/v1/requests')
      .send({
        topicSlug: 'anxiety-stress',
        format: 'video',
        ...(expertId ? { expertId } : {}),
      })
      .expect(201);
    const offers = await get(exp.accessToken, '/v1/experts/me/offers').expect(
      200,
    );
    const offerId = offers.body[0].offerId as string;
    const accepted = await post(
      exp.accessToken,
      `/v1/offers/${offerId}/accept`,
    ).expect(200);
    return accepted.body.consultationId as string;
  }

  it('прямой цикл: карта -> матч -> холд -> COMPLETED -> capture 85% (Р-02) -> вывод 10 000 тг (автоодобрен) -> вебхук paid; ledger сбалансирован, полная audit-цепочка', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    // Цена 15 000 ₸ — снапшотится в консультацию при матче.
    await prisma.expert.update({
      where: { id: exp.expertId },
      data: { priceTiyn: PRICE_TIYN },
    });
    const cardId = await addCard(cli.accessToken);

    const consultationId = await matchClientToExpert(cli, exp);

    await post(cli.accessToken, `/v1/consultations/${consultationId}/pay`)
      .send({ paymentMethodId: cardId })
      .expect(200);

    await post(exp.accessToken, `/v1/consultations/${consultationId}/complete`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { consultationId },
    });
    expect(payment.status).toBe('CAPTURED');

    // Р-02: разбивка «цена − 15% = итого» в earnings.
    const earnings = await get(
      exp.accessToken,
      '/v1/experts/me/earnings',
    ).expect(200);
    expect(earnings.body.balanceTiyn).toBe(NET_TIYN);
    expect(earnings.body.items[0]).toMatchObject({
      consultationId,
      priceTiyn: PRICE_TIYN,
      commissionTiyn: COMMISSION_TIYN,
      netTiyn: NET_TIYN,
    });

    // Вывод 10 000 ₸ — в пределах месячного лимита, автоодобрен.
    const payoutRes = await post(exp.accessToken, '/v1/payouts')
      .send({
        amountTiyn: PAYOUT_TIYN,
        pan: VISA_PAN,
        expiry: '12/28',
        holderName: 'Ivan Petrov',
      })
      .expect(201);
    expect(payoutRes.body.status).toBe('PROCESSING');
    const payoutId = payoutRes.body.id as string;

    const balanceAfter = await get(
      exp.accessToken,
      '/v1/experts/me/balance',
    ).expect(200);
    expect(balanceAfter.body.balanceTiyn).toBe(NET_TIYN - PAYOUT_TIYN);

    const payout = await prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
    });
    const webhookBody = {
      eventId: 'evt-money-e2e-paid-1',
      type: 'payout.paid',
      providerRefId: payout.providerRefId,
    };
    await request(app.getHttpServer())
      .post('/v1/webhooks/payouts')
      .set('x-payout-signature', signPayoutWebhook(webhookBody))
      .set('Content-Type', 'application/json')
      .send(webhookBody)
      .expect(200);
    expect(
      (await prisma.payout.findUniqueOrThrow({ where: { id: payoutId } }))
        .status,
    ).toBe('PAID');

    // Ledger: каждая транзакция цикла сбалансирована (Σdebit == Σcredit).
    const transactions = await prisma.ledgerTransaction.findMany({
      where: {
        OR: [
          { kind: 'capture', refId: payment.id },
          {
            kind: { in: ['payout_reserve', 'payout_sent'] },
            refId: payoutId,
          },
        ],
      },
      include: { entries: true },
    });
    expect(transactions).toHaveLength(3);
    for (const t of transactions) {
      const sumDebit = t.entries.reduce((s, e) => s + e.debitTiyn, 0);
      const sumCredit = t.entries.reduce((s, e) => s + e.creditTiyn, 0);
      expect(sumDebit).toBe(sumCredit);
      expect(sumDebit).toBeGreaterThan(0);
    }

    // Балансы счетов после полного цикла.
    expect(await ledger.balanceTiyn(expertAccount(exp.expertId))).toBe(
      NET_TIYN - PAYOUT_TIYN,
    );
    expect((await ledger.balanceTiyn(ACC_COMMISSION)) - commissionBefore).toBe(
      COMMISSION_TIYN,
    );
    expect(
      (await ledger.balanceTiyn(ACC_PAYOUT_PENDING)) - payoutPendingBefore,
    ).toBe(0);
    expect((await ledger.balanceTiyn(ACC_PAYOUT_SENT)) - payoutSentBefore).toBe(
      PAYOUT_TIYN,
    );
    // Эквайер — общий счёт: на него пишут и подписки Premium, поэтому
    // сравниваем движение за сценарий, а не абсолютный баланс базы.
    expect((await ledger.balanceTiyn(ACC_ACQUIRER)) - acquirerBefore).toBe(
      -PRICE_TIYN,
    );

    // Полная audit-цепочка payment.*/payout.*.
    const auditRows = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entity: 'payment', entityId: payment.id },
          { entity: 'payout', entityId: payoutId },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });
    const transitions = auditRows.map((a) => a.transition);
    expect(transitions).toEqual(
      expect.arrayContaining([
        'payment.held',
        'payment.captured',
        'payout.requested',
        'payout.paid',
      ]),
    );
  });

  it('обратный цикл: холд -> advance(5 дней) -> перехолд -> CLIENT_NO_SHOW -> void, балансы нулевые; no-show + 2 отмены -> AUTO_MATCH_DISABLED, направленная заявка работает', async () => {
    const exp = await acceptingExpert(PH_E2);
    const cli = await clientUser(PH_C2);
    const cardId = await addCard(cli.accessToken);

    const consultationId = await matchClientToExpert(cli, exp);
    await post(cli.accessToken, `/v1/consultations/${consultationId}/pay`)
      .send({ paymentMethodId: cardId })
      .expect(200);

    const held = await prisma.payment.findUniqueOrThrow({
      where: { consultationId },
    });
    const originalHoldId = held.providerHoldId!;

    // Перехолд Р-01 на виртуальном времени: банковский холд не живёт >5 дней.
    fakeClock.advance(5 * 24 * 60 * 60 * 1000 + 1000);
    await timer.sweep();

    const reheld = await prisma.payment.findUniqueOrThrow({
      where: { consultationId },
    });
    expect(reheld.status).toBe('HELD');
    expect(reheld.reholdCount).toBe(1);
    expect(reheld.providerHoldId).not.toBe(originalHoldId);

    // Исход «клиент не пришёл» -> void перехолженного холда, эксперту 0,
    // клиенту полный возврат (холд снят, capture не было).
    await post(exp.accessToken, `/v1/consultations/${consultationId}/complete`)
      .send({ outcome: 'CLIENT_NO_SHOW' })
      .expect(200);

    const voided = await prisma.payment.findUniqueOrThrow({
      where: { consultationId },
    });
    expect(voided.status).toBe('VOIDED');

    // Деньги не двигались: ledger пуст, балансы нулевые.
    expect(
      await prisma.ledgerTransaction.count({
        where: { kind: 'capture', refId: voided.id },
      }),
    ).toBe(0);
    expect(await ledger.balanceTiyn(expertAccount(exp.expertId))).toBe(0);
    expect((await ledger.balanceTiyn(ACC_ACQUIRER)) - acquirerBefore).toBe(0);
    expect((await ledger.balanceTiyn(ACC_COMMISSION)) - commissionBefore).toBe(
      0,
    );

    const auditTransitions = (
      await prisma.auditLog.findMany({
        where: { entity: 'payment', entityId: voided.id },
      })
    ).map((a) => a.transition);
    expect(auditTransitions).toEqual(
      expect.arrayContaining([
        'payment.held',
        'payment.reheld',
        'payment.voided',
      ]),
    );

    // Р-01/Р-17: no-show выше — уже 1-й инцидент злоупотребления; ещё две
    // отмены клиентом добирают лимит «3+ за 30 дней» — автоподбор закрыт.
    for (let i = 0; i < 2; i++) {
      const cId = await matchClientToExpert(cli, exp);
      await post(cli.accessToken, `/v1/consultations/${cId}/cancel`).expect(
        200,
      );
    }

    const blocked = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(403);
    expect(blocked.body.error.code).toBe('AUTO_MATCH_DISABLED');

    // Направленная заявка (ручной выбор из каталога) работает.
    const directedConsultationId = await matchClientToExpert(
      cli,
      exp,
      exp.expertId,
    );
    expect(directedConsultationId).toBeTruthy();
  });
});
