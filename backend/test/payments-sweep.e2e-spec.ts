import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHmac } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { ClockService } from '../src/common/clock/clock.service';
import { LedgerService, expertAccount } from '../src/ledger/ledger.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { OfferTimerService } from '../src/requests/offer-timer.service';
import { createApp } from './utils/create-app';
import { acceptingExpert as acceptingExpertHelper } from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Номера спека задачи 6 (E5, sweep денег), не пересекаются с другими спеками.
const PH_E1 = '+77086000001';
const PH_E2 = '+77086000002';
const PH_E3 = '+77086000003';
const PH_E4 = '+77086000004';
const PH_C1 = '+77086000091';
const PH_C2 = '+77086000092';
const PH_C3 = '+77086000093';
const PH_C4 = '+77086000094';
const ALL_PHONES = [PH_E1, PH_E2, PH_E3, PH_E4, PH_C1, PH_C2, PH_C3, PH_C4];

const VISA_PAN = '4111111111111111';
const WEBHOOK_SECRET =
  'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

// Виртуальные часы: старт в среду 2026-08-20 10:00 Asia/Almaty (05:00 UTC).
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

describe('Sweep денег: ретраи settle, перехолд, вебхуки провайдера (E5, задача 6, виртуальное время)', () => {
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
    await prisma.ledgerEntry.deleteMany({
      where: {
        OR: [
          { account: { in: expertIds.map((id) => expertAccount(id)) } },
          { account: 'acquirer:settlement' },
          { account: 'platform:commission' },
        ],
      },
    });
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
    if (paymentIds.length) {
      await prisma.ledgerTransaction.deleteMany({
        where: { kind: 'capture', refId: { in: paymentIds } },
      });
    }
    await prisma.providerEvent.deleteMany({
      where: { kind: 'payment' },
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entity: 'request' },
          { entity: 'offer' },
          { entity: 'consultation' },
          { entity: 'payment' },
          { entity: 'expert', entityId: { in: expertIds } },
        ],
      },
    });
    await prisma.payment.deleteMany({
      where: {
        OR: [
          { expertId: { in: expertIds } },
          { clientUserId: { in: userIds } },
        ],
      },
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

    const keys = await redis.keys('mockpay:*');
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

  beforeEach(async () => {
    fakeClock.current = new Date('2026-08-20T05:00:00Z');
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function acceptingExpert(
    phone: string,
    overrides: { topics?: string[]; formats?: string[] } = {},
  ) {
    const result = await acceptingExpertHelper(
      app,
      phone,
      () => lastCode,
      overrides,
    );
    registeredExpertIds.push(result.expertId);
    return result;
  }

  async function clientUser(phone: string) {
    return clientUserHelper(app, phone, () => lastCode);
  }

  async function addCard(accessToken: string, pan: string) {
    const res = await post(accessToken, '/v1/payment-methods')
      .send({ pan, expiry: '12/28', holderName: 'Ivan Petrov' })
      .expect(201);
    return res.body.id as string;
  }

  async function matchClientToExpert(
    cli: { accessToken: string },
    exp: { accessToken: string; expertId: string },
  ) {
    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
    const offers = await get(exp.accessToken, '/v1/experts/me/offers').expect(
      200,
    );
    const offerId = offers.body[0].offerId as string;
    const accepted = await post(
      exp.accessToken,
      `/v1/offers/${offerId}/accept`,
    ).expect(200);
    return {
      requestId: r.body.id as string,
      consultationId: accepted.body.consultationId as string,
    };
  }

  async function payHeld(
    cli: { accessToken: string },
    consultationId: string,
    cardId: string,
  ) {
    await post(cli.accessToken, `/v1/consultations/${consultationId}/pay`)
      .send({ paymentMethodId: cardId })
      .expect(200);
  }

  function signWebhook(body: object): string {
    return createHmac('sha256', WEBHOOK_SECRET)
      .update(JSON.stringify(body))
      .digest('hex');
  }

  it('ретрай settle: сломанный provider на capture оставляет Payment HELD после complete; sweep после починки доводит до CAPTURED без задвоения баланса', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const cardId = await addCard(cli.accessToken, VISA_PAN);
    const { consultationId } = await matchClientToExpert(cli, exp);
    await payHeld(cli, consultationId, cardId);

    const payment = await prisma.payment.findUnique({
      where: { consultationId },
    });
    const providerHoldId = payment!.providerHoldId!;

    // Ломаем мок: удаляем redis-ключ холда -> capture внутри complete()
    // кинет ConflictException -> settleSafely проглотит ошибку -> Payment
    // остаётся HELD, хотя консультация уже COMPLETED.
    await redis.del(`mockpay:hold:${providerHoldId}`);

    await post(exp.accessToken, `/v1/consultations/${consultationId}/complete`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);

    const heldAfterComplete = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(heldAfterComplete!.status).toBe('HELD');

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });
    expect(consultation!.status).toBe('COMPLETED');

    // Первый sweep — провайдер всё ещё сломан, ретрай не проходит, Payment
    // остаётся HELD, settleAttempts увеличивается.
    await timer.sweep();
    const stillHeld = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(stillHeld!.status).toBe('HELD');
    expect(stillHeld!.settleAttempts).toBeGreaterThanOrEqual(1);

    // Восстанавливаем холд в Redis в исходном формате мока.
    await redis.set(
      `mockpay:hold:${providerHoldId}`,
      JSON.stringify({
        providerHoldId,
        token: 'restored',
        amountTiyn: payment!.amountTiyn,
        status: 'held',
      }),
      'EX',
      24 * 60 * 60,
    );

    await timer.sweep();

    const capturedPayment = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(capturedPayment!.status).toBe('CAPTURED');

    const balance = await ledger.balanceTiyn(expertAccount(exp.expertId));
    expect(balance).toBe(339150);

    // Повторный sweep — идемпотентность, баланс не задваивается.
    await timer.sweep();
    const balanceAfterSecondSweep = await ledger.balanceTiyn(
      expertAccount(exp.expertId),
    );
    expect(balanceAfterSecondSweep).toBe(339150);
  });

  it('ретрай settle: после 10 неудачных попыток -> audit payment.settle_exhausted, дальше sweep не трогает Payment (settleAttempts не растёт)', async () => {
    const exp = await acceptingExpert(PH_E4);
    const cli = await clientUser(PH_C4);
    const cardId = await addCard(cli.accessToken, VISA_PAN);
    const { consultationId } = await matchClientToExpert(cli, exp);
    await payHeld(cli, consultationId, cardId);

    const payment = await prisma.payment.findUnique({
      where: { consultationId },
    });
    const providerHoldId = payment!.providerHoldId!;

    // Ломаем мок насовсем (не чиним) — каждый settle-ретрай будет падать.
    await redis.del(`mockpay:hold:${providerHoldId}`);

    await post(exp.accessToken, `/v1/consultations/${consultationId}/complete`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);

    for (let i = 0; i < 10; i++) {
      await timer.sweep();
    }

    const exhausted = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(exhausted!.status).toBe('HELD');
    expect(exhausted!.settleAttempts).toBe(10);

    const auditExhausted = await prisma.auditLog.findFirst({
      where: { entity: 'payment', transition: 'payment.settle_exhausted' },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditExhausted).not.toBeNull();
    expect((auditExhausted!.payload as any).consultationId).toBe(
      consultationId,
    );

    // Дальнейшие sweep НЕ трогают эту запись — лимит достигнут, settle()
    // больше не вызывается для неё (settleAttempts не растёт дальше).
    await timer.sweep();
    const afterExtraSweep = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(afterExtraSweep!.settleAttempts).toBe(10);
  });

  it('перехолд Р-01: >5 дней без исхода -> новый providerHoldId, reholdCount 1, HELD; повторный sweep без advance — без изменений', async () => {
    const exp = await acceptingExpert(PH_E2);
    const cli = await clientUser(PH_C2);
    const cardId = await addCard(cli.accessToken, VISA_PAN);
    const { consultationId } = await matchClientToExpert(cli, exp);
    await payHeld(cli, consultationId, cardId);

    const paymentBefore = await prisma.payment.findUnique({
      where: { consultationId },
    });
    const originalHoldId = paymentBefore!.providerHoldId!;

    fakeClock.advance(5 * 24 * 60 * 60 * 1000 + 1000);
    await timer.sweep();

    const reholdedPayment = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(reholdedPayment!.status).toBe('HELD');
    expect(reholdedPayment!.reholdCount).toBe(1);
    expect(reholdedPayment!.providerHoldId).not.toBe(originalHoldId);
    expect(reholdedPayment!.holdCreatedAt!.getTime()).toBe(
      fakeClock.current.getTime(),
    );

    // Повторный sweep без advance — holdCreatedAt только что обновлён,
    // условие '>5 дней' больше не выполняется, идемпотентность.
    await timer.sweep();
    const afterSecondSweep = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(afterSecondSweep!.reholdCount).toBe(1);
    expect(afterSecondSweep!.providerHoldId).toBe(
      reholdedPayment!.providerHoldId,
    );
  });

  it('перехолд: отказ банка -> Payment FAILED, paymentStatus FAILED, audit payment.rehold_failed', async () => {
    const exp = await acceptingExpert(PH_E3);
    const cli = await clientUser(PH_C3);
    const cardId = await addCard(cli.accessToken, VISA_PAN);
    const { consultationId } = await matchClientToExpert(cli, exp);
    await payHeld(cli, consultationId, cardId);

    // Подменяем providerToken карты на decline-токен, чтобы перехолд
    // (новый hold()) получил decline от мока.
    const payment = await prisma.payment.findUnique({
      where: { consultationId },
    });
    await prisma.paymentMethod.update({
      where: { id: payment!.paymentMethodId },
      data: { providerToken: 'mockpay_tok_0002_forced-decline' },
    });

    fakeClock.advance(5 * 24 * 60 * 60 * 1000 + 1000);
    await timer.sweep();

    const failedPayment = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(failedPayment!.status).toBe('FAILED');

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });
    expect(consultation!.paymentStatus).toBe('FAILED');

    const auditReholdFailed = await prisma.auditLog.findFirst({
      where: { entity: 'payment', transition: 'payment.rehold_failed' },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditReholdFailed).not.toBeNull();
  });

  it('вебхук hold.voided_by_bank: валидная подпись -> Payment FAILED; мусорная -> 401; повтор eventId -> 200 без повторного эффекта', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const cardId = await addCard(cli.accessToken, VISA_PAN);
    const { consultationId } = await matchClientToExpert(cli, exp);
    await payHeld(cli, consultationId, cardId);

    const payment = await prisma.payment.findUnique({
      where: { consultationId },
    });
    const providerHoldId = payment!.providerHoldId!;

    const body = {
      eventId: `evt-${consultationId}`,
      type: 'hold.voided_by_bank',
      providerHoldId,
    };
    const rawBody = JSON.stringify(body);
    const validSignature = signWebhook(body);

    const badRes = await request(app.getHttpServer())
      .post('/v1/webhooks/payments')
      .set('Content-Type', 'application/json')
      .set('X-Payment-Signature', 'deadbeef'.repeat(8))
      .send(rawBody)
      .expect(401);
    expect(badRes.body.error.code).toBe('WEBHOOK_INVALID');

    await request(app.getHttpServer())
      .post('/v1/webhooks/payments')
      .set('Content-Type', 'application/json')
      .set('X-Payment-Signature', validSignature)
      .send(rawBody)
      .expect(200);

    const failedPayment = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(failedPayment!.status).toBe('FAILED');

    // Повторная доставка того же eventId -> 200, дедуп по ProviderEvent,
    // статус не меняется повторно (уже FAILED — не откатывается).
    await request(app.getHttpServer())
      .post('/v1/webhooks/payments')
      .set('Content-Type', 'application/json')
      .set('X-Payment-Signature', validSignature)
      .send(rawBody)
      .expect(200);

    const afterRedelivery = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(afterRedelivery!.status).toBe('FAILED');
  });
});
