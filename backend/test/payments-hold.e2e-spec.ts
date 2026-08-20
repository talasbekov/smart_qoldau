import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { PresenceService } from '../src/presence/presence.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { acceptingExpert as acceptingExpertHelper } from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Номера спека задачи 4 (E5, Платёжный контур), не пересекаются с другими
// спеками.
const PH_E1 = '+77086000001';
const PH_E2 = '+77086000002';
const PH_C1 = '+77086000091';
const PH_C2 = '+77086000092';
const PH_C3 = '+77086000093';
const PH_C4 = '+77086000094';
const PH_C5 = '+77086000095'; // «чужой» клиент в тесте 404
const ALL_PHONES = [PH_E1, PH_E2, PH_C1, PH_C2, PH_C3, PH_C4, PH_C5];

const VISA_PAN = '4111111111111111';
const DECLINE_PAN = '4000000000000002'; // оканчивается на 0002 -> decline

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

describe('Холд при оплате консультации (E5, задача 4, Р-01)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
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

  it('pay хорошей картой -> 200, Payment HELD, paymentStatus HELD у обеих сторон, у эксперта нет maskedPan', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const cardId = await addCard(cli.accessToken, VISA_PAN);

    const { consultationId } = await matchClientToExpert(cli, exp);

    const payRes = await post(
      cli.accessToken,
      `/v1/consultations/${consultationId}/pay`,
    )
      .send({ paymentMethodId: cardId })
      .expect(200);

    expect(payRes.body.status).toBe('HELD');

    const payment = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(payment).not.toBeNull();
    expect(payment!.status).toBe('HELD');
    expect(payment!.providerHoldId).toBeTruthy();
    expect(payment!.holdCreatedAt).not.toBeNull();
    expect(payment!.commissionTiyn).toBe(
      Math.round(payment!.amountTiyn * 0.15),
    );

    const clientView = await get(
      cli.accessToken,
      `/v1/consultations/${consultationId}`,
    ).expect(200);
    expect(clientView.body.paymentStatus).toBe('HELD');

    const expertView = await get(
      exp.accessToken,
      `/v1/consultations/${consultationId}`,
    ).expect(200);
    expect(expertView.body.paymentStatus).toBe('HELD');
    expect(JSON.stringify(expertView.body)).not.toMatch(/maskedPan/);

    // GET /v1/consultations/:id/payment — клиент видит статус платежа
    const clientPayment = await get(
      cli.accessToken,
      `/v1/consultations/${consultationId}/payment`,
    ).expect(200);
    expect(clientPayment.body.status).toBe('HELD');
    expect(clientPayment.body.amountTiyn).toBeGreaterThan(0);
    expect(clientPayment.body.maskedPan).toBe('**** 1111');

    // Эксперт не видит платёж клиента (PII)
    const expertPaymentRes = await get(
      exp.accessToken,
      `/v1/consultations/${consultationId}/payment`,
    ).expect(404);
    expect(expertPaymentRes.body.error.code).toBe('CONSULTATION_NOT_FOUND');
  });

  it('повторный pay после HELD -> 409 ALREADY_PAID', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C2);
    const cardId = await addCard(cli.accessToken, VISA_PAN);

    const { consultationId } = await matchClientToExpert(cli, exp);

    await post(cli.accessToken, `/v1/consultations/${consultationId}/pay`)
      .send({ paymentMethodId: cardId })
      .expect(200);

    const second = await post(
      cli.accessToken,
      `/v1/consultations/${consultationId}/pay`,
    )
      .send({ paymentMethodId: cardId })
      .expect(409);
    expect(second.body.error.code).toBe('ALREADY_PAID');
  });

  it('pay declined-картой -> 402, Payment FAILED, затем pay хорошей картой -> HELD (восстановление после отказа)', async () => {
    const exp = await acceptingExpert(PH_E2);
    const cli = await clientUser(PH_C3);
    const badCardId = await addCard(cli.accessToken, DECLINE_PAN);
    const goodCardId = await addCard(cli.accessToken, VISA_PAN);

    const { consultationId } = await matchClientToExpert(cli, exp);

    const declined = await post(
      cli.accessToken,
      `/v1/consultations/${consultationId}/pay`,
    )
      .send({ paymentMethodId: badCardId })
      .expect(402);
    expect(declined.body.error.code).toBe('PROVIDER_DECLINED');

    const payment1 = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(payment1!.status).toBe('FAILED');
    expect(payment1!.failReason).toBeTruthy();

    const clientViewAfterFail = await get(
      cli.accessToken,
      `/v1/consultations/${consultationId}`,
    ).expect(200);
    expect(clientViewAfterFail.body.paymentStatus).toBe('FAILED');

    const retry = await post(
      cli.accessToken,
      `/v1/consultations/${consultationId}/pay`,
    )
      .send({ paymentMethodId: goodCardId })
      .expect(200);
    expect(retry.body.status).toBe('HELD');

    const payment2 = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(payment2!.id).toBe(payment1!.id); // та же строка, upsert
    expect(payment2!.status).toBe('HELD');
    expect(payment2!.paymentMethodId).toBe(goodCardId);

    const clientViewAfterHeld = await get(
      cli.accessToken,
      `/v1/consultations/${consultationId}`,
    ).expect(200);
    expect(clientViewAfterHeld.body.paymentStatus).toBe('HELD');
  });

  it('чужая консультация -> 404 CONSULTATION_NOT_FOUND', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C4);
    const stranger = await clientUser(PH_C5);
    const cardId = await addCard(stranger.accessToken, VISA_PAN);

    const { consultationId } = await matchClientToExpert(cli, exp);

    const res = await post(
      stranger.accessToken,
      `/v1/consultations/${consultationId}/pay`,
    )
      .send({ paymentMethodId: cardId })
      .expect(404);
    expect(res.body.error.code).toBe('CONSULTATION_NOT_FOUND');
  });

  it('параллельные два pay -> один холд у провайдера (идемпотентность redis-ключа)', async () => {
    const exp = await acceptingExpert(PH_E2);
    const cli = await clientUser(PH_C1);
    const cardId = await addCard(cli.accessToken, VISA_PAN);

    // Свежая пара клиент/эксперт для избежания конфликта с предыдущими
    // тестами (используем новый номер эксперта, чтобы не пересекаться по
    // presence-состоянию — но клиент/номер тот же PH_C1, для этого теста
    // достаточно новой консультации).
    const { consultationId } = await matchClientToExpert(cli, exp);

    const [r1, r2] = await Promise.all([
      post(cli.accessToken, `/v1/consultations/${consultationId}/pay`).send({
        paymentMethodId: cardId,
      }),
      post(cli.accessToken, `/v1/consultations/${consultationId}/pay`).send({
        paymentMethodId: cardId,
      }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    // Один успешен (200), второй либо тоже 200 (идемпотентный ответ), либо
    // 409 ALREADY_PAID если пришёл позже записи в БД — в обоих случаях в
    // БД/у провайдера должен остаться РОВНО один холд.
    expect(statuses).toContain(200);

    const payment = await prisma.payment.findUnique({
      where: { consultationId },
    });
    expect(payment).not.toBeNull();
    expect(payment!.status).toBe('HELD');

    const holdKeys = await redis.keys('mockpay:hold:*');
    // Считаем холды, привязанные к этому провайдер-холду (косвенно —
    // providerHoldId консультации должен быть валидным и единственным
    // holdом, созданным для этого idempotencyKey).
    let matchingHolds = 0;
    for (const key of holdKeys) {
      const raw = await redis.get(key);
      if (
        raw &&
        payment!.providerHoldId &&
        key.endsWith(payment!.providerHoldId)
      ) {
        matchingHolds++;
      }
    }
    expect(matchingHolds).toBe(1);

    // Прямая проверка идемпотентности по ключу: mockpay:idem:hold:{id}
    // должен указывать на тот же providerHoldId, что и запись Payment.
    const idemValue = await redis.get(`mockpay:idem:hold:${consultationId}`);
    expect(idemValue).toBe(payment!.providerHoldId);
  });
});
