import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHmac } from 'crypto';
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
import {
  registeredExpertUser,
  verifiedExpert as verifiedExpertHelper,
} from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Номера спека задачи 7 (E5, выводы), не пересекаются с другими спеками.
const PH_E1 = '+77089000001';
const PH_E2 = '+77089000002';
const PH_E3 = '+77089000003';
const PH_E4 = '+77089000004';
const PH_E5 = '+77089000005';
const PH_E6 = '+77089000006';
const PH_E7 = '+77089000007';
const PH_C1 = '+77089000091';
const ALL_PHONES = [PH_E1, PH_E2, PH_E3, PH_E4, PH_E5, PH_E6, PH_E7, PH_C1];

const VISA_PAN = '4111111111111111';
const PAYOUT_WEBHOOK_SECRET =
  'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1';

// Суммы в тиынах: минимум вывода 10 000 ₸, автоодобрение до 300 000 ₸/мес.
const MIN_PAYOUT_TIYN = 1_000_000;
const CARD = { pan: VISA_PAN, expiry: '12/28', holderName: 'Aigul S' };

const SEED_KIND = 'seed:payouts-e2e';

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
function get(token: string, url: string) {
  return request(app.getHttpServer())
    .get(url)
    .set('Authorization', `Bearer ${token}`);
}

function signWebhook(body: object): string {
  return createHmac('sha256', PAYOUT_WEBHOOK_SECRET)
    .update(JSON.stringify(body))
    .digest('hex');
}

describe('Выводы средств эксперта (E5, задача 7, Р-06)', () => {
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
            kind: { in: ['payout_reserve', 'payout_sent'] },
            refId: { in: payoutIds },
          },
        ],
      },
    });
    await prisma.providerEvent.deleteMany({
      where: { providerEventId: { startsWith: 'evt-payout-e2e-' } },
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

  async function verifiedExpert(phone: string) {
    return verifiedExpertHelper(app, phone, () => lastCode);
  }

  // Прямые проводки вместо полного пути консультация+pay+complete — балансу
  // всё равно, откуда кредит; полный путь уже покрыт payments-settle.
  async function seedBalance(expertId: string, amountTiyn: number) {
    seedCounter++;
    await ledger.post(SEED_KIND, `seed-${expertId}-${seedCounter}`, [
      { account: ACC_ACQUIRER, debitTiyn: amountTiyn },
      { account: expertAccount(expertId), creditTiyn: amountTiyn },
    ]);
  }

  it('минимум: вывод 999 900 тиын (< 10 000 тг) -> 400 PAYOUT_MIN_AMOUNT, Payout не создан', async () => {
    const exp = await verifiedExpert(PH_E1);
    await seedBalance(exp.expertId, 5_000_000);

    const res = await post(exp.accessToken, '/v1/payouts')
      .send({ amountTiyn: 999_900, ...CARD })
      .expect(400);
    expect(res.body.error.code).toBe('PAYOUT_MIN_AMOUNT');

    expect(
      await prisma.payout.count({ where: { expertId: exp.expertId } }),
    ).toBe(0);
    // Резерв не проводился — баланс не тронут.
    expect(await ledger.balanceTiyn(expertAccount(exp.expertId))).toBe(
      5_000_000,
    );
  });

  it('больше баланса -> 400 INSUFFICIENT_BALANCE', async () => {
    const exp = await verifiedExpert(PH_E2);
    await seedBalance(exp.expertId, 2_000_000);

    const res = await post(exp.accessToken, '/v1/payouts')
      .send({ amountTiyn: 3_000_000, ...CARD })
      .expect(400);
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE');
    expect(await ledger.balanceTiyn(expertAccount(exp.expertId))).toBe(
      2_000_000,
    );
  });

  it('валидный вывод 1 000 000 тиын -> PROCESSING, баланс уменьшен сразу (резерв), провайдер вызван, список отдаёт маску карты', async () => {
    const exp = await verifiedExpert(PH_E3);
    await seedBalance(exp.expertId, 5_000_000);

    const before = await get(exp.accessToken, '/v1/experts/me/balance').expect(
      200,
    );
    expect(before.body).toEqual({
      balanceTiyn: 5_000_000,
      availableTiyn: 5_000_000,
    });

    const res = await post(exp.accessToken, '/v1/payouts')
      .send({ amountTiyn: MIN_PAYOUT_TIYN, ...CARD })
      .expect(201);
    expect(res.body.status).toBe('PROCESSING');
    expect(res.body.amountTiyn).toBe(MIN_PAYOUT_TIYN);
    expect(res.body.maskedPan).toBe('**** 1111');
    const payoutId = res.body.id as string;

    // Резерв снял деньги с баланса немедленно, до подтверждения провайдера.
    const after = await get(exp.accessToken, '/v1/experts/me/balance').expect(
      200,
    );
    expect(after.body).toEqual({
      balanceTiyn: 4_000_000,
      availableTiyn: 4_000_000,
    });
    expect(await ledger.balanceTiyn(ACC_PAYOUT_PENDING)).toBe(MIN_PAYOUT_TIYN);

    // Провайдер вызван немедленно (автоодобрение в пределах месячного лимита).
    const payout = await prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
    });
    expect(payout.providerRefId).toBeTruthy();
    expect(await redis.get(`mockpayout:idem:payout:${payoutId}`)).toBeTruthy();

    const list = await get(exp.accessToken, '/v1/payouts').expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({
      id: payoutId,
      amountTiyn: MIN_PAYOUT_TIYN,
      maskedPan: '**** 1111',
      status: 'PROCESSING',
      rejectReason: null,
    });

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'payout', entityId: payoutId },
    });
    expect(audit?.transition).toBe('payout.requested');
    expect(audit?.payload).toMatchObject({
      amountTiyn: MIN_PAYOUT_TIYN,
      autoApproved: true,
    });
  });

  it('вебхук payout.paid -> PAID + проводка payout_sent; повтор eventId -> 200 без второго эффекта; мусорная подпись -> 401', async () => {
    const exp = await verifiedExpert(PH_E4);
    await seedBalance(exp.expertId, 5_000_000);

    const res = await post(exp.accessToken, '/v1/payouts')
      .send({ amountTiyn: MIN_PAYOUT_TIYN, ...CARD })
      .expect(201);
    const payoutId = res.body.id as string;
    const payout = await prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
    });

    const body = {
      eventId: 'evt-payout-e2e-paid-1',
      type: 'payout.paid',
      providerRefId: payout.providerRefId,
    };

    // Мусорная подпись -> 401, статус не изменился.
    const bad = await request(app.getHttpServer())
      .post('/v1/webhooks/payouts')
      .set('x-payout-signature', 'deadbeef')
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(401);
    expect(bad.body.error.code).toBe('WEBHOOK_INVALID');

    await request(app.getHttpServer())
      .post('/v1/webhooks/payouts')
      .set('x-payout-signature', signWebhook(body))
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(200);

    const paid = await prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
    });
    expect(paid.status).toBe('PAID');
    expect(await ledger.balanceTiyn(ACC_PAYOUT_PENDING)).toBe(0);
    expect(await ledger.balanceTiyn(ACC_PAYOUT_SENT)).toBe(MIN_PAYOUT_TIYN);

    // Повторная доставка того же события: 200 no-op, проводка одна.
    await request(app.getHttpServer())
      .post('/v1/webhooks/payouts')
      .set('x-payout-signature', signWebhook(body))
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(200);
    expect(
      await prisma.ledgerTransaction.count({
        where: { kind: 'payout_sent', refId: payoutId },
      }),
    ).toBe(1);
    expect(await ledger.balanceTiyn(ACC_PAYOUT_SENT)).toBe(MIN_PAYOUT_TIYN);

    // Неизвестный providerRefId -> 200 без эффекта (существование не
    // раскрываем).
    const unknown = {
      eventId: 'evt-payout-e2e-paid-unknown',
      type: 'payout.paid',
      providerRefId: 'mockpayout_ref_nonexistent',
    };
    await request(app.getHttpServer())
      .post('/v1/webhooks/payouts')
      .set('x-payout-signature', signWebhook(unknown))
      .set('Content-Type', 'application/json')
      .send(unknown)
      .expect(200);
  });

  it('два параллельных вывода на весь баланс -> ровно один прошёл (FOR UPDATE), баланс 0', async () => {
    const exp = await verifiedExpert(PH_E5);
    await seedBalance(exp.expertId, MIN_PAYOUT_TIYN);

    const [a, b] = await Promise.all([
      post(exp.accessToken, '/v1/payouts').send({
        amountTiyn: MIN_PAYOUT_TIYN,
        ...CARD,
      }),
      post(exp.accessToken, '/v1/payouts').send({
        amountTiyn: MIN_PAYOUT_TIYN,
        ...CARD,
      }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 400]);
    const failed = a.status === 400 ? a : b;
    expect(failed.body.error.code).toBe('INSUFFICIENT_BALANCE');

    expect(
      await prisma.payout.count({ where: { expertId: exp.expertId } }),
    ).toBe(1);
    expect(await ledger.balanceTiyn(expertAccount(exp.expertId))).toBe(0);
  });

  it('месячный лимит 30 000 000 тиын: превышение -> PENDING_REVIEW, провайдер НЕ вызван', async () => {
    const exp = await verifiedExpert(PH_E6);
    await seedBalance(exp.expertId, 40_000_000);

    const first = await post(exp.accessToken, '/v1/payouts')
      .send({ amountTiyn: 25_000_000, ...CARD })
      .expect(201);
    expect(first.body.status).toBe('PROCESSING');

    // 25M + 6M = 31M > 30M за календарный месяц -> очередь финконтроля.
    const second = await post(exp.accessToken, '/v1/payouts')
      .send({ amountTiyn: 6_000_000, ...CARD })
      .expect(201);
    expect(second.body.status).toBe('PENDING_REVIEW');
    const secondId = second.body.id as string;

    const pending = await prisma.payout.findUniqueOrThrow({
      where: { id: secondId },
    });
    expect(pending.providerRefId).toBeNull();
    expect(await redis.get(`mockpayout:idem:payout:${secondId}`)).toBeNull();

    // Резерв проведён и для PENDING_REVIEW — деньги уже сняты с баланса.
    expect(await ledger.balanceTiyn(expertAccount(exp.expertId))).toBe(
      40_000_000 - 25_000_000 - 6_000_000,
    );

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'payout', entityId: secondId },
    });
    expect(audit?.payload).toMatchObject({ autoApproved: false });
  });

  it('доступ: клиент без анкеты -> 404 EXPERT_NOT_FOUND; неверифицированный эксперт -> 403 NOT_VERIFIED', async () => {
    const cli = await clientUserHelper(app, PH_C1, () => lastCode);

    for (const path of ['/v1/experts/me/balance', '/v1/payouts']) {
      const res = await get(cli.accessToken, path).expect(404);
      expect(res.body.error.code).toBe('EXPERT_NOT_FOUND');
    }
    const cliPost = await post(cli.accessToken, '/v1/payouts')
      .send({ amountTiyn: MIN_PAYOUT_TIYN, ...CARD })
      .expect(404);
    expect(cliPost.body.error.code).toBe('EXPERT_NOT_FOUND');

    const draft = await registeredExpertUser(app, PH_E7, () => lastCode);
    const res = await post(draft.accessToken, '/v1/payouts')
      .send({ amountTiyn: MIN_PAYOUT_TIYN, ...CARD })
      .expect(403);
    expect(res.body.error.code).toBe('NOT_VERIFIED');
  });
});
