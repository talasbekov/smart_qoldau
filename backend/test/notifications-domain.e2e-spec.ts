import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import request from 'supertest';
import { createHmac } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { ClockService } from '../src/common/clock/clock.service';
import { LedgerService, expertAccount } from '../src/ledger/ledger.service';
import { OfferTimerService } from '../src/requests/offer-timer.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { AdminAuth, adminUser } from './utils/admin-helpers';
import {
  registeredExpertUser,
  acceptingExpert as acceptingExpertHelper,
  verifiedExpert as verifiedExpertHelper,
} from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Номера спека задачи 6 (E9, хуки доменных событий), не пересекаются с
// другими спеками.
const PH_E1 = '+77097000001';
const PH_E2 = '+77097000002';
const PH_E3 = '+77097000003';
const PH_E4 = '+77097000004';
const PH_E5 = '+77097000005';
const PH_E6 = '+77097000006';
const PH_C1 = '+77097000091';
const PH_C5 = '+77097000095';
const PH_C6 = '+77097000096';
const ALL_PHONES = [
  PH_E1,
  PH_E2,
  PH_E3,
  PH_E4,
  PH_E5,
  PH_E6,
  PH_C1,
  PH_C5,
  PH_C6,
];

// Оба сотрудника спека (задача 5 E8a: /admin/verification/* через
// VERIFICATION_OPERATOR, /admin/payouts/* через FINANCE_CONTROL) —
// одноразовые, с явным email под общим префиксом спека, чистятся в cleanup().
const ADMIN_EMAIL_PREFIX = 'notifications-domain-e2e-';
const VISA_PAN = '4111111111111111';
const CARD = { pan: VISA_PAN, expiry: '12/28', holderName: 'Aigul S' };
const PAYOUT_WEBHOOK_SECRET =
  'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1';
const DOC_TYPES = ['IDENTITY', 'DIPLOMA', 'CERTIFICATES', 'QUALIFICATION'];
const SEED_KIND = 'seed:notifications-domain-e2e';
const MIN_PAYOUT_TIYN = 1_000_000; // 10 000 ₸
const OVER_LIMIT_TIYN = 31_000_000; // 310 000 ₸ > месячного лимита 300 000 ₸
const PAYOUT_PAID_EVENT_ID = 'evt-notifications-domain-paid-1';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

// Виртуальные часы: старт в среду 2026-08-20 10:00 Asia/Almaty (05:00 UTC),
// как в остальных спеках эпика с виртуальным временем.
const fakeClock = {
  current: new Date('2026-08-20T05:00:00Z'),
  now(): Date {
    return new Date(this.current);
  },
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  },
};

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

let app: INestApplication;

describe('Уведомления доменных событий: деньги, верификация, консультации (E9, задача 6)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  let ledger: LedgerService;
  let timer: OfferTimerService;
  let operatorAuth: AdminAuth;
  let financeAuth: AdminAuth;
  const registeredExpertIds: string[] = [];
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
    if (registeredExpertIds.length) {
      await redis.srem('experts:available', ...registeredExpertIds);
      await redis.hdel('experts:lastseen', ...registeredExpertIds);
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

    await prisma.ledgerEntry.deleteMany({
      where: {
        OR: [
          { account: { in: expertIds.map((id) => expertAccount(id)) } },
          {
            account: {
              in: [
                'acquirer:settlement',
                'platform:commission',
                'payout:pending',
                'payout:sent',
              ],
            },
          },
        ],
      },
    });
    await prisma.ledgerTransaction.deleteMany({
      where: {
        OR: [
          { kind: SEED_KIND },
          { kind: 'capture', refId: { in: paymentIds } },
          {
            kind: { in: ['payout_reserve', 'payout_sent', 'payout_reject'] },
            refId: { in: payoutIds },
          },
        ],
      },
    });

    await prisma.notification.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.device.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.providerEvent.deleteMany({
      where: { kind: 'payout', providerEventId: PAYOUT_PAID_EVENT_ID },
    });
    await prisma.payout.deleteMany({ where: { id: { in: payoutIds } } });
    await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
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

    const keys = await redis.keys('mockpush:*');
    if (keys.length) await redis.del(...keys);
    const payoutKeys = await redis.keys('mockpayout:*');
    if (payoutKeys.length) await redis.del(...payoutKeys);
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
    operatorAuth = await adminUser(
      app,
      [AdminRole.VERIFICATION_OPERATOR],
      `${ADMIN_EMAIL_PREFIX}operator-${Date.now()}@smartqoldau.kz`,
    );
    financeAuth = await adminUser(
      app,
      [AdminRole.FINANCE_CONTROL],
      `${ADMIN_EMAIL_PREFIX}finance-${Date.now()}@smartqoldau.kz`,
    );
  });

  beforeEach(async () => {
    fakeClock.current = new Date('2026-08-20T05:00:00Z');
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    // adminUser (operatorAuth/financeAuth) НЕ в cleanup(): она вызывается в
    // beforeEach перед КАЖДЫМ тестом, а обе строки создаются один раз в
    // beforeAll — удаление их в cleanup() убирало бы сотрудников до первого
    // же теста (финальное ревью E8a, п.7). Строки убираются только здесь,
    // после всех тестов сьюта.
    await prisma.adminUser.deleteMany({
      where: { email: { startsWith: ADMIN_EMAIL_PREFIX } },
    });
    await app.close();
  });

  async function acceptingExpert(phone: string) {
    const result = await acceptingExpertHelper(app, phone, () => lastCode);
    registeredExpertIds.push(result.expertId);
    return result;
  }

  async function verifiedExpert(phone: string) {
    const result = await verifiedExpertHelper(app, phone, () => lastCode);
    registeredExpertIds.push(result.expertId);
    return result;
  }

  async function clientUser(phone: string) {
    return clientUserHelper(app, phone, () => lastCode);
  }

  async function addDevice(accessToken: string, token: string) {
    await request(app.getHttpServer())
      .post('/v1/devices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ platform: 'android', token })
      .expect(201);
  }

  async function userIdByExpertId(expertId: string): Promise<string> {
    const expert = await prisma.expert.findUniqueOrThrow({
      where: { id: expertId },
    });
    return expert.userId;
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
    format: 'chat' | 'audio' | 'video' = 'video',
  ) {
    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format })
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

  async function seedBalance(expertId: string, amountTiyn: number) {
    seedCounter++;
    await ledger.post(SEED_KIND, `seed-${expertId}-${seedCounter}`, [
      { account: 'acquirer:settlement', debitTiyn: amountTiyn },
      { account: expertAccount(expertId), creditTiyn: amountTiyn },
    ]);
  }

  async function pushSentTo(token: string): Promise<any[]> {
    const sent = await redis.lrange(`mockpush:sent:${token}`, 0, -1);
    return sent.map((s) => JSON.parse(s));
  }

  // Устройство эксперта может получить и другие пуши эпика (например,
  // критичный offer.incoming при выдаче оффера, задача 5) — ищем именно тот,
  // что относится к проверяемому Notification.
  function pushForNotification(sent: any[], notificationId: string): any {
    const found = sent.find((s) => s.data?.notificationId === notificationId);
    expect(found).toBeDefined();
    return found;
  }

  it('оплата + complete -> эксперту in-app earning.credited с суммой + mockpush', async () => {
    const exp = await acceptingExpert(PH_E1);
    const userId = await userIdByExpertId(exp.expertId);
    await addDevice(exp.accessToken, 'dom-tok-e1');
    const cli = await clientUser(PH_C1);
    const cardId = await addCard(cli.accessToken, VISA_PAN);
    const { consultationId } = await matchClientToExpert(cli, exp);
    await payHeld(cli, consultationId, cardId);

    await post(exp.accessToken, `/v1/consultations/${consultationId}/complete`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);

    const stored = await prisma.notification.findFirstOrThrow({
      where: { userId, type: 'earning.credited' },
    });
    expect(stored.title).toBe('Начисление');
    // priceTiyn=399000, комиссия 15% = 59850, netTiyn=339150 -> 3392 ₸.
    expect(stored.body).toContain('3 392');
    expect((stored.data as any).amountTiyn).toBe(339150);
    expect(stored.pushSentAt).not.toBeNull();

    const sent = await pushSentTo('dom-tok-e1');
    const push = pushForNotification(sent, stored.id);
    expect(push.title).toBe('Начисление');
  });

  it('payout paid-вебхук -> эксперту in-app payout.updated PAID с суммой и картой + mockpush', async () => {
    const exp = await verifiedExpert(PH_E2);
    const userId = await userIdByExpertId(exp.expertId);
    await addDevice(exp.accessToken, 'dom-tok-e2');
    await seedBalance(exp.expertId, 5_000_000);

    const res = await post(exp.accessToken, '/v1/payouts')
      .send({ amountTiyn: MIN_PAYOUT_TIYN, ...CARD })
      .expect(201);
    expect(res.body.status).toBe('PROCESSING');
    const payoutId = res.body.id as string;
    const payout = await prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
    });

    const body = {
      eventId: PAYOUT_PAID_EVENT_ID,
      type: 'payout.paid',
      providerRefId: payout.providerRefId,
    };
    await request(app.getHttpServer())
      .post('/v1/webhooks/payouts')
      .set('x-payout-signature', signWebhook(body))
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(200);

    const stored = await prisma.notification.findFirstOrThrow({
      where: { userId, type: 'payout.paid' },
    });
    expect(stored.title).toBe('Выплата отправлена');
    expect(stored.body).toContain('10 000');
    expect(stored.body).toContain('**** 1111');
    expect(stored.pushSentAt).not.toBeNull();

    const sent = await pushSentTo('dom-tok-e2');
    const push = pushForNotification(sent, stored.id);
    expect(push.title).toBe('Выплата отправлена');
  });

  it('admin reject payout -> эксперту in-app payout.updated REJECTED с причиной + mockpush', async () => {
    const exp = await verifiedExpert(PH_E3);
    const userId = await userIdByExpertId(exp.expertId);
    await addDevice(exp.accessToken, 'dom-tok-e3');
    await seedBalance(exp.expertId, 40_000_000);

    const res = await post(exp.accessToken, '/v1/payouts')
      .send({ amountTiyn: OVER_LIMIT_TIYN, ...CARD })
      .expect(201);
    expect(res.body.status).toBe('PENDING_REVIEW');
    const payoutId = res.body.id as string;

    await request(app.getHttpServer())
      .post(`/v1/admin/payouts/${payoutId}/reject`)
      .set(...financeAuth.authHeader)
      .send({ reason: 'Подозрительная активность' })
      .expect(200);

    const stored = await prisma.notification.findFirstOrThrow({
      where: { userId, type: 'payout.rejected' },
    });
    expect(stored.title).toBe('Выплата отклонена');
    expect(stored.body).toContain('Подозрительная активность');
    expect(stored.pushSentAt).not.toBeNull();

    const sent = await pushSentTo('dom-tok-e3');
    pushForNotification(sent, stored.id);
  });

  it('верификация approve -> эксперту in-app verification.updated + mockpush', async () => {
    const registered = await registeredExpertUser(app, PH_E4, () => lastCode);
    registeredExpertIds.push(registered.expertId);
    const userId = await userIdByExpertId(registered.expertId);
    await addDevice(registered.accessToken, 'dom-tok-e4');

    for (const type of DOC_TYPES) {
      await request(app.getHttpServer())
        .post(`/v1/experts/me/documents/${type}`)
        .set('Authorization', `Bearer ${registered.accessToken}`)
        .attach('file', Buffer.from('%PDF-1.4 fake'), 'doc.pdf')
        .expect(201);
    }
    await request(app.getHttpServer())
      .post('/v1/experts/me/documents/submit')
      .set('Authorization', `Bearer ${registered.accessToken}`)
      .expect(200);

    const queue = await request(app.getHttpServer())
      .get('/v1/admin/verification/queue')
      .set(...operatorAuth.authHeader)
      .expect(200);
    const entry = queue.body.find((e: any) => e.id === registered.expertId);
    const docIds: string[] = entry.documents.map((d: any) => d.id);
    for (const id of docIds) {
      await request(app.getHttpServer())
        .post(`/v1/admin/verification/documents/${id}/decision`)
        .set(...operatorAuth.authHeader)
        .send({ approve: true })
        .expect(200);
    }

    await request(app.getHttpServer())
      .post(`/v1/admin/verification/${registered.expertId}/decision`)
      .set(...operatorAuth.authHeader)
      .send({ approve: true })
      .expect(200);

    const stored = await prisma.notification.findFirstOrThrow({
      where: { userId, type: 'verification.approved' },
    });
    expect(stored.title).toBe('Профиль подтверждён');
    expect(stored.pushSentAt).not.toBeNull();

    const sent = await pushSentTo('dom-tok-e4');
    pushForNotification(sent, stored.id);
  });

  it('отмена клиентом -> эксперту in-app consultation.cancelled + mockpush', async () => {
    const exp = await acceptingExpert(PH_E5);
    const userId = await userIdByExpertId(exp.expertId);
    await addDevice(exp.accessToken, 'dom-tok-e5');
    const cli = await clientUser(PH_C5);
    const { consultationId } = await matchClientToExpert(cli, exp);

    await post(
      cli.accessToken,
      `/v1/consultations/${consultationId}/cancel`,
    ).expect(200);

    const stored = await prisma.notification.findFirstOrThrow({
      where: { userId, type: 'consultation.cancelled' },
    });
    expect(stored.title).toBe('Консультация отменена');
    expect(stored.pushSentAt).not.toBeNull();

    const sent = await pushSentTo('dom-tok-e5');
    pushForNotification(sent, stored.id);
  });

  it('no-show sweep-хинт -> эксперту in-app consultation.no_show_hint + mockpush', async () => {
    const exp = await acceptingExpert(PH_E6);
    const userId = await userIdByExpertId(exp.expertId);
    await addDevice(exp.accessToken, 'dom-tok-e6');
    const cli = await clientUser(PH_C6);
    const { consultationId } = await matchClientToExpert(cli, exp, 'video');

    fakeClock.advance(181_000);
    await timer.sweep();

    const row = await prisma.consultation.findUniqueOrThrow({
      where: { id: consultationId },
    });
    expect(row.noShowNotifiedAt).not.toBeNull();

    const stored = await prisma.notification.findFirstOrThrow({
      where: { userId, type: 'consultation.no_show_hint' },
    });
    expect(stored.title).toBe('Клиент не подключился');
    expect(stored.pushSentAt).not.toBeNull();

    const sent = await pushSentTo('dom-tok-e6');
    pushForNotification(sent, stored.id);
  });
});
