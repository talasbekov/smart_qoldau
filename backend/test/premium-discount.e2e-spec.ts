import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { acceptingExpert as acceptingExpertHelper } from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Р-03: клиент Premium платит на 10 % меньше, а эксперт всё равно получает
// 85 % ПОЛНОЙ цены — скидку оплачивает платформа из своей комиссии.
const PRICE_TIYN = 399_000; // 3 990 ₸
const DISCOUNT_TIYN = 39_900; // 10 %
const PREMIUM_AMOUNT_TIYN = 359_100; // клиент платит столько
const PREMIUM_COMMISSION_TIYN = 19_950; // 5 % от ПОЛНОЙ цены
const REGULAR_COMMISSION_TIYN = 59_850; // 15 % от полной цены
const EXPERT_NET_TIYN = 339_150; // 85 % от полной цены — при любой ставке

const PH_E1 = '+77087300001';
const PH_E2 = '+77087300002';
const PH_C1 = '+77087300091';
const PH_C2 = '+77087300092';
const ALL_PHONES = [PH_E1, PH_E2, PH_C1, PH_C2];

const VISA_PAN = '4111111111111111';

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

describe('Premium: скидка 10 % и комиссия 5 % (Р-03, e2e)', () => {
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
    const payments = await prisma.payment.findMany({
      where: { clientUserId: { in: userIds } },
      select: { id: true },
    });
    const subs = await prisma.subscription.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const txs = await prisma.ledgerTransaction.findMany({
      where: {
        OR: [
          { kind: 'capture', refId: { in: payments.map((p) => p.id) } },
          ...subs.map((s) => ({ refId: { startsWith: s.id } })),
        ],
      },
      select: { id: true },
    });
    const txIds = txs.map((t) => t.id);
    await prisma.ledgerEntry.deleteMany({
      where: { transactionId: { in: txIds } },
    });
    await prisma.ledgerTransaction.deleteMany({ where: { id: { in: txIds } } });
    await prisma.payment.deleteMany({
      where: { id: { in: payments.map((p) => p.id) } },
    });
    await prisma.subscription.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.paymentMethod.deleteMany({
      where: { userId: { in: userIds } },
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
      where: {
        entityId: { in: [...userIds, ...expertIds, ...subs.map((s) => s.id)] },
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    registeredExpertIds.length = 0;
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
  });

  beforeEach(() => cleanup());

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function expertWithPrice(phone: string) {
    const exp = await acceptingExpertHelper(app, phone, () => lastCode);
    registeredExpertIds.push(exp.expertId);
    await prisma.expert.update({
      where: { id: exp.expertId },
      data: { priceTiyn: PRICE_TIYN },
    });
    return exp;
  }

  async function addCard(accessToken: string) {
    const res = await post(accessToken, '/v1/payment-methods')
      .send({ pan: VISA_PAN, expiry: '12/28', holderName: 'Ivan Petrov' })
      .expect(201);
    return res.body.id as string;
  }

  async function matchAndPay(
    cli: { accessToken: string },
    exp: { accessToken: string; expertId: string },
    cardId: string,
  ) {
    await post(cli.accessToken, '/v1/requests')
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
    const consultationId = accepted.body.consultationId as string;
    await post(cli.accessToken, `/v1/consultations/${consultationId}/pay`)
      .send({ paymentMethodId: cardId })
      .expect(200);
    return consultationId;
  }

  async function premiumClient(phone: string) {
    const cli = await clientUserHelper(app, phone, () => lastCode);
    const cardId = await addCard(cli.accessToken);
    await post(cli.accessToken, '/v1/premium/subscribe')
      .send({ plan: 'MONTH', paymentMethodId: cardId })
      .expect(201);
    return { ...cli, cardId };
  }

  it('Premium-клиент платит на 10 % меньше, эксперт получает 85 % ПОЛНОЙ цены', async () => {
    const exp = await expertWithPrice(PH_E1);
    const cli = await premiumClient(PH_C1);

    const consultationId = await matchAndPay(cli, exp, cli.cardId);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { consultationId },
    });
    expect(payment.amountTiyn).toBe(PREMIUM_AMOUNT_TIYN);
    expect(payment.discountTiyn).toBe(DISCOUNT_TIYN);
    expect(payment.commissionRateBp).toBe(500);
    // Комиссия — от ПОЛНОЙ цены по ставке 5 %: эксперт не должен терять
    // из-за чужой подписки.
    expect(payment.commissionTiyn).toBe(PREMIUM_COMMISSION_TIYN);

    await post(exp.accessToken, `/v1/consultations/${consultationId}/complete`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);

    const entry = await prisma.ledgerEntry.findFirstOrThrow({
      where: { account: `expert:${exp.expertId}` },
    });
    expect(entry.creditTiyn).toBe(EXPERT_NET_TIYN);

    // Эксперт видит полную цену и своё удержание 15 % — чужая подписка в
    // его разбивке не отражается вообще, и «цена − комиссия = итого»
    // сходится (Р-02). 5 % — фактический доход платформы, не его дело.
    const earnings = await get(
      exp.accessToken,
      '/v1/experts/me/earnings',
    ).expect(200);
    expect(earnings.body.items[0]).toMatchObject({
      consultationId,
      priceTiyn: PRICE_TIYN,
      commissionTiyn: REGULAR_COMMISSION_TIYN,
      netTiyn: EXPERT_NET_TIYN,
    });
    expect(earnings.body.balanceTiyn).toBe(EXPERT_NET_TIYN);
  });

  it('обычный клиент: цена полная, комиссия 15 %', async () => {
    const exp = await expertWithPrice(PH_E2);
    const cli = await clientUserHelper(app, PH_C2, () => lastCode);
    const cardId = await addCard(cli.accessToken);

    const consultationId = await matchAndPay(cli, exp, cardId);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { consultationId },
    });
    expect(payment.amountTiyn).toBe(PRICE_TIYN);
    expect(payment.discountTiyn).toBe(0);
    expect(payment.commissionRateBp).toBe(1500);
    expect(payment.commissionTiyn).toBe(REGULAR_COMMISSION_TIYN);

    await post(exp.accessToken, `/v1/consultations/${consultationId}/complete`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);
    const entry = await prisma.ledgerEntry.findFirstOrThrow({
      where: { account: `expert:${exp.expertId}` },
    });
    expect(entry.creditTiyn).toBe(PRICE_TIYN - REGULAR_COMMISSION_TIYN);
  });

  it('подписка, отменённая ПОСЛЕ оплаты, не пересчитывает прошлый платёж', async () => {
    const exp = await expertWithPrice(PH_E1);
    const cli = await premiumClient(PH_C1);
    const consultationId = await matchAndPay(cli, exp, cli.cardId);

    await post(cli.accessToken, '/v1/premium/cancel').expect(200);
    await prisma.subscription.updateMany({
      where: { userId: cli.userId },
      data: { status: 'EXPIRED' },
    });

    // Снимок в Payment — не вычисление на лету: вчерашняя консультация не
    // пересчитывается задним числом.
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { consultationId },
    });
    expect(payment.discountTiyn).toBe(DISCOUNT_TIYN);
    expect(payment.commissionRateBp).toBe(500);

    await post(exp.accessToken, `/v1/consultations/${consultationId}/complete`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);
    const entry = await prisma.ledgerEntry.findFirstOrThrow({
      where: { account: `expert:${exp.expertId}` },
    });
    expect(entry.creditTiyn).toBe(EXPERT_NET_TIYN);
  });
});
