import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { PresenceService } from '../src/presence/presence.service';
import { LedgerService, expertAccount } from '../src/ledger/ledger.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { acceptingExpert as acceptingExpertHelper } from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Номера спека задачи 5 (E5, Платёжный контур, settle), не пересекаются с
// другими спеками.
const PH_E1 = '+77087000001';
const PH_E2 = '+77087000002';
const PH_E3 = '+77087000003';
const PH_E4 = '+77087000004';
const PH_E5 = '+77087000005';
const PH_E6 = '+77087000006';
const PH_C1 = '+77087000091';
const PH_C2 = '+77087000092';
const PH_C3 = '+77087000093';
const PH_C4 = '+77087000094';
const PH_C5 = '+77087000095';
const PH_C6 = '+77087000096';
const ALL_PHONES = [
  PH_E1,
  PH_E2,
  PH_E3,
  PH_E4,
  PH_E5,
  PH_E6,
  PH_C1,
  PH_C2,
  PH_C3,
  PH_C4,
  PH_C5,
  PH_C6,
];

const VISA_PAN = '4111111111111111';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

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

let app: INestApplication;

describe('Settle по исходу консультации (E5, задача 5, Р-01/Р-02)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  let ledger: LedgerService;
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
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    ledger = app.get(LedgerService);
    app.get(PresenceService);
  });

  beforeEach(() => cleanup());

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

  it('happy: pay -> complete COMPLETED -> Payment CAPTURED, баланс эксперта 85% (399000 -> 339150 + комиссия 59850), earnings отдаёт разбивку', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const cardId = await addCard(cli.accessToken, VISA_PAN);
    const { consultationId } = await matchClientToExpert(cli, exp);
    await payHeld(cli, consultationId, cardId);

    const payment = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(payment!.amountTiyn).toBe(399000);

    await post(exp.accessToken, `/v1/consultations/${consultationId}/complete`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);

    // settle работает "после" ответа — небольшой запас не нужен, т.к. await
    // внутри complete()/settle() синхронно завершается до ответа клиенту в
    // реализации; тем не менее опрашиваем БД напрямую.
    const capturedPayment = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(capturedPayment!.status).toBe('CAPTURED');
    expect(capturedPayment!.commissionTiyn).toBe(59850);

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });
    expect(consultation!.paymentStatus).toBe('CAPTURED');

    const balance = await ledger.balanceTiyn(expertAccount(exp.expertId));
    expect(balance).toBe(339150);

    const commissionBalance = await ledger.balanceTiyn('platform:commission');
    expect(commissionBalance).toBe(59850);

    const acquirerBalance = await ledger.balanceTiyn('acquirer:settlement');
    expect(acquirerBalance).toBe(-399000);

    const earnings = await get(
      exp.accessToken,
      '/v1/experts/me/earnings',
    ).expect(200);
    expect(earnings.body.balanceTiyn).toBe(339150);
    expect(earnings.body.items.length).toBe(1);
    expect(earnings.body.items[0]).toMatchObject({
      consultationId,
      priceTiyn: 399000,
      commissionTiyn: 59850,
      netTiyn: 339150,
    });
    expect(earnings.body.items[0].createdAt).toBeTruthy();

    const auditCaptured = await prisma.auditLog.findFirst({
      where: { entity: 'payment', transition: 'payment.captured' },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditCaptured).not.toBeNull();
    expect((auditCaptured!.payload as any).amountTiyn).toBe(399000);
    expect((auditCaptured!.payload as any).commissionTiyn).toBe(59850);
  });

  it('no-show: pay -> complete CLIENT_NO_SHOW -> Payment VOIDED, баланс эксперта 0, ledger пуст', async () => {
    const exp = await acceptingExpert(PH_E2);
    const cli = await clientUser(PH_C2);
    const cardId = await addCard(cli.accessToken, VISA_PAN);
    const { consultationId } = await matchClientToExpert(cli, exp);
    await payHeld(cli, consultationId, cardId);

    await post(exp.accessToken, `/v1/consultations/${consultationId}/complete`)
      .send({ outcome: 'CLIENT_NO_SHOW' })
      .expect(200);

    const payment = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(payment!.status).toBe('VOIDED');

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });
    expect(consultation!.paymentStatus).toBe('VOIDED');

    const balance = await ledger.balanceTiyn(expertAccount(exp.expertId));
    expect(balance).toBe(0);

    const txCount = await prisma.ledgerTransaction.count({
      where: { refId: payment!.id },
    });
    expect(txCount).toBe(0);

    const auditVoided = await prisma.auditLog.findFirst({
      where: { entity: 'payment', transition: 'payment.voided' },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditVoided).not.toBeNull();
    expect((auditVoided!.payload as any).outcome).toBe('CLIENT_NO_SHOW');
  });

  it('отмена клиентом -> Payment VOIDED', async () => {
    const exp = await acceptingExpert(PH_E3);
    const cli = await clientUser(PH_C3);
    const cardId = await addCard(cli.accessToken, VISA_PAN);
    const { consultationId } = await matchClientToExpert(cli, exp);
    await payHeld(cli, consultationId, cardId);

    await post(
      cli.accessToken,
      `/v1/consultations/${consultationId}/cancel`,
    ).expect(200);

    const payment = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(payment!.status).toBe('VOIDED');

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });
    expect(consultation!.paymentStatus).toBe('VOIDED');
  });

  it('complete без оплаты -> COMPLETED без денег, audit payment.missing_on_completion, баланс 0', async () => {
    const exp = await acceptingExpert(PH_E4);
    const cli = await clientUser(PH_C4);
    const { consultationId } = await matchClientToExpert(cli, exp);

    await post(exp.accessToken, `/v1/consultations/${consultationId}/complete`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });
    expect(consultation!.status).toBe('COMPLETED');
    expect(consultation!.paymentStatus).toBe('UNPAID');

    const payment = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(payment).toBeNull();

    const balance = await ledger.balanceTiyn(expertAccount(exp.expertId));
    expect(balance).toBe(0);

    const auditMissing = await prisma.auditLog.findFirst({
      where: {
        entity: 'payment',
        transition: 'payment.missing_on_completion',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditMissing).not.toBeNull();
  });

  it('повторный complete -> 409, settle не задваивает баланс', async () => {
    const exp = await acceptingExpert(PH_E5);
    const cli = await clientUser(PH_C5);
    const cardId = await addCard(cli.accessToken, VISA_PAN);
    const { consultationId } = await matchClientToExpert(cli, exp);
    await payHeld(cli, consultationId, cardId);

    await post(exp.accessToken, `/v1/consultations/${consultationId}/complete`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);

    const balanceAfterFirst = await ledger.balanceTiyn(
      expertAccount(exp.expertId),
    );
    expect(balanceAfterFirst).toBe(339150);

    const second = await post(
      exp.accessToken,
      `/v1/consultations/${consultationId}/complete`,
    )
      .send({ outcome: 'COMPLETED' })
      .expect(409);
    expect(second.body.error.code).toBe('CONSULTATION_NOT_ACTIVE');

    const balanceAfterSecond = await ledger.balanceTiyn(
      expertAccount(exp.expertId),
    );
    expect(balanceAfterSecond).toBe(339150);
  });

  it('невалидный outcome в complete -> 400 VALIDATION_FAILED', async () => {
    const exp = await acceptingExpert(PH_E6);
    const cli = await clientUser(PH_C6);
    const { consultationId } = await matchClientToExpert(cli, exp);

    const res = await post(
      exp.accessToken,
      `/v1/consultations/${consultationId}/complete`,
    )
      .send({ outcome: 'NOT_A_REAL_OUTCOME' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
