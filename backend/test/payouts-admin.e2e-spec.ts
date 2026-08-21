import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import {
  ACC_ACQUIRER,
  ACC_PAYOUT_PENDING,
  ACC_PAYOUT_SENT,
  LedgerService,
  expertAccount,
} from '../src/ledger/ledger.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { verifiedExpert as verifiedExpertHelper } from './utils/expert-helpers';

// Номера спека задачи 8 (E5, финконтроль), не пересекаются с другими спеками.
const PH_E1 = '+77090000001';
const PH_E2 = '+77090000002';
const PH_E3 = '+77090000003';
const PH_E4 = '+77090000004';
const PH_E5 = '+77090000005';
const ALL_PHONES = [PH_E1, PH_E2, PH_E3, PH_E4, PH_E5];

const ADMIN = { 'X-Admin-Token': 'dev-admin-token-0123456789abcdef' };
const CARD = {
  pan: '4111111111111111',
  expiry: '12/28',
  holderName: 'Aigul S',
};

// 31 000 000 тиын (310 000 ₸) > месячного лимита автоодобрения 300 000 ₸ —
// одна заявка сразу уходит в PENDING_REVIEW.
const OVER_LIMIT_TIYN = 31_000_000;
const SEED_TIYN = 40_000_000;

const SEED_KIND = 'seed:payouts-admin-e2e';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

let app: INestApplication;

function post(token: string, url: string) {
  return request(app.getHttpServer())
    .post(url)
    .set('Authorization', `Bearer ${token}`);
}

describe('Финконтроль выводов в админке (E5, задача 8, Р-06)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  let ledger: LedgerService;
  let seedCounter = 0;

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
    const payouts = await prisma.payout.findMany({
      where: { expertId: { in: expertIds } },
      select: { id: true },
    });
    const payoutIds = payouts.map((p) => p.id);

    await prisma.ledgerEntry.deleteMany({
      where: {
        OR: [
          { account: { in: expertIds.map((id) => expertAccount(id)) } },
          {
            account: {
              in: [ACC_ACQUIRER, ACC_PAYOUT_PENDING, ACC_PAYOUT_SENT],
            },
          },
        ],
      },
    });
    await prisma.ledgerTransaction.deleteMany({
      where: {
        OR: [
          { kind: SEED_KIND },
          {
            kind: { in: ['payout_reserve', 'payout_sent', 'payout_reject'] },
            refId: { in: payoutIds },
          },
        ],
      },
    });
    await prisma.payout.deleteMany({ where: { id: { in: payoutIds } } });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entity: 'payout' },
          { entity: 'expert', entityId: { in: expertIds } },
        ],
      },
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

    const keys = await redis.keys('mockpayout:*');
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
  });

  beforeEach(() => cleanup());

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function seedBalance(expertId: string, amountTiyn: number) {
    seedCounter++;
    await ledger.post(SEED_KIND, `seed-${expertId}-${seedCounter}`, [
      { account: ACC_ACQUIRER, debitTiyn: amountTiyn },
      { account: expertAccount(expertId), creditTiyn: amountTiyn },
    ]);
  }

  // verified эксперт + баланс + заявка сверх месячного лимита -> PENDING_REVIEW.
  async function pendingReviewPayout(phone: string) {
    const exp = await verifiedExpertHelper(app, phone, () => lastCode);
    await seedBalance(exp.expertId, SEED_TIYN);
    const res = await post(exp.accessToken, '/v1/payouts')
      .send({ amountTiyn: OVER_LIMIT_TIYN, ...CARD })
      .expect(201);
    expect(res.body.status).toBe('PENDING_REVIEW');
    return { exp, payoutId: res.body.id as string };
  }

  it('очередь: PENDING_REVIEW-вывод виден с monthTotalTiyn; без админ-токена -> 401', async () => {
    const { exp, payoutId } = await pendingReviewPayout(PH_E1);

    const unauthorized = await request(app.getHttpServer())
      .get('/v1/admin/payouts?status=PENDING_REVIEW')
      .expect(401);
    expect(unauthorized.body.error.code).toBe('UNAUTHORIZED');

    const queue = await request(app.getHttpServer())
      .get('/v1/admin/payouts?status=PENDING_REVIEW')
      .set(ADMIN)
      .expect(200);
    const item = queue.body.items.find((p: any) => p.id === payoutId);
    expect(item).toMatchObject({
      id: payoutId,
      expertId: exp.expertId,
      amountTiyn: OVER_LIMIT_TIYN,
      maskedPan: '**** 1111',
      holderName: 'Aigul S',
      // Сумма выводов эксперта за календарный месяц (вкл. этот).
      monthTotalTiyn: OVER_LIMIT_TIYN,
    });
  });

  it('approve -> PROCESSING, провайдер вызван идемпотентным ключом payout:{id}, audit payout.approved', async () => {
    const { payoutId } = await pendingReviewPayout(PH_E2);

    await request(app.getHttpServer())
      .post(`/v1/admin/payouts/${payoutId}/approve`)
      .set(ADMIN)
      .expect(200);

    const payout = await prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
    });
    expect(payout.status).toBe('PROCESSING');
    expect(payout.providerRefId).toBeTruthy();
    expect(await redis.get(`mockpayout:idem:payout:${payoutId}`)).toBeTruthy();

    const audit = await prisma.auditLog.findFirst({
      where: {
        entity: 'payout',
        entityId: payoutId,
        transition: 'payout.approved',
      },
    });
    expect(audit).toBeTruthy();
  });

  it('reject с причиной -> REJECTED, компенсирующая проводка вернула баланс; reject без причины -> 400', async () => {
    const { exp, payoutId } = await pendingReviewPayout(PH_E3);

    // Резерв уже снял сумму с баланса.
    expect(await ledger.balanceTiyn(expertAccount(exp.expertId))).toBe(
      SEED_TIYN - OVER_LIMIT_TIYN,
    );

    const noReason = await request(app.getHttpServer())
      .post(`/v1/admin/payouts/${payoutId}/reject`)
      .set(ADMIN)
      .send({})
      .expect(400);
    expect(noReason.body.error.code).toBe('VALIDATION_FAILED');

    await request(app.getHttpServer())
      .post(`/v1/admin/payouts/${payoutId}/reject`)
      .set(ADMIN)
      .send({ reason: 'Подозрительная активность' })
      .expect(200);

    const payout = await prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
    });
    expect(payout.status).toBe('REJECTED');
    expect(payout.rejectReason).toBe('Подозрительная активность');
    // Провайдер не вызывался.
    expect(payout.providerRefId).toBeNull();
    expect(await redis.get(`mockpayout:idem:payout:${payoutId}`)).toBeNull();

    // Деньги вернулись: expert снова полный seed, pending обнулился.
    expect(await ledger.balanceTiyn(expertAccount(exp.expertId))).toBe(
      SEED_TIYN,
    );
    expect(await ledger.balanceTiyn(ACC_PAYOUT_PENDING)).toBe(0);

    const audit = await prisma.auditLog.findFirst({
      where: {
        entity: 'payout',
        entityId: payoutId,
        transition: 'payout.rejected',
      },
    });
    expect(audit?.payload).toMatchObject({
      reason: 'Подозрительная активность',
    });
  });

  it('approve/reject не из PENDING_REVIEW -> 409', async () => {
    const exp = await verifiedExpertHelper(app, PH_E4, () => lastCode);
    await seedBalance(exp.expertId, 5_000_000);
    // В пределах лимита -> сразу PROCESSING (автоодобрение).
    const res = await post(exp.accessToken, '/v1/payouts')
      .send({ amountTiyn: 1_000_000, ...CARD })
      .expect(201);
    expect(res.body.status).toBe('PROCESSING');
    const payoutId = res.body.id as string;

    const approve = await request(app.getHttpServer())
      .post(`/v1/admin/payouts/${payoutId}/approve`)
      .set(ADMIN)
      .expect(409);
    expect(approve.body.error.code).toBe('PAYOUT_NOT_PENDING');

    const reject = await request(app.getHttpServer())
      .post(`/v1/admin/payouts/${payoutId}/reject`)
      .set(ADMIN)
      .send({ reason: 'Поздно' })
      .expect(409);
    expect(reject.body.error.code).toBe('PAYOUT_NOT_PENDING');
  });
});
