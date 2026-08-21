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
  expertAccount,
} from '../src/ledger/ledger.service';
import { OfferTimerService } from '../src/requests/offer-timer.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { acceptingExpert as acceptingExpertHelper } from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Номера спека задачи 9 (E9, сквозной e2e шины уведомлений), не пересекаются
// с другими спеками.
const PH_E1 = '+77099000001';
const PH_C1 = '+77099000091';
const PH_C2 = '+77099000092';
const ALL_PHONES = [PH_E1, PH_C1, PH_C2];

const VISA_PAN = '4111111111111111';
const CARD = { pan: VISA_PAN, expiry: '12/28', holderName: 'Aigul S' };
const PAYOUT_WEBHOOK_SECRET =
  'f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1';
const PAYOUT_PAID_EVENT_ID = 'evt-notifications-lifecycle-paid-1';
const SMS_FALLBACK_TEXT = 'SmartQoldau: новая заявка, откройте приложение';

// Цена 15 000 ₸: 85% net = 1 275 000 тиын («12 750 ₸») — выше минимума
// вывода 10 000 ₸ (1 000 000 тиын, «10 000 ₸»), весь денежный цикл
// укладывается в одну консультацию (как money-lifecycle.e2e-spec.ts, E5).
const PRICE_TIYN = 1_500_000;
const COMMISSION_TIYN = 225_000; // 15%
const NET_TIYN = PRICE_TIYN - COMMISSION_TIYN; // 1 275 000 -> «12 750»
const PAYOUT_TIYN = 1_000_000; // 10 000 ₸ -> «10 000»

let lastCode = '';
// Все SMS-отправки за тест (включая коды подтверждения входа) — фильтруем
// по точному тексту fallback-сообщения в ассертах.
const sentSms: { phone: string; text: string }[] = [];

class FakeSmsProvider implements SmsProvider {
  async send(phone: string, text: string): Promise<void> {
    sentSms.push({ phone, text });
    const match = text.match(/(\d{4})/);
    if (match) lastCode = match[1];
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

describe('Сквозной e2e шины уведомлений: заявка -> критичный пуш -> SMS-fallback -> деньги -> центр -> отмена (E9, задача 9)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
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

    await prisma.ledgerEntry.deleteMany({
      where: {
        OR: [
          { account: { in: expertIds.map((id) => expertAccount(id)) } },
          {
            account: {
              in: [
                ACC_ACQUIRER,
                ACC_COMMISSION,
                ACC_PAYOUT_PENDING,
                ACC_PAYOUT_SENT,
              ],
            },
          },
        ],
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
          { entity: 'notification' },
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
    timer = app.get(OfferTimerService);
  });

  beforeEach(async () => {
    fakeClock.current = new Date('2026-08-20T05:00:00Z');
    sentSms.length = 0;
    await cleanup();
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

  async function addDevice(
    accessToken: string,
    token: string,
    locale?: string,
  ) {
    await post(accessToken, '/v1/devices')
      .send({ platform: 'android', token, ...(locale ? { locale } : {}) })
      .expect(201);
  }

  async function addCard(accessToken: string, pan: string) {
    const res = await post(accessToken, '/v1/payment-methods')
      .send({ pan, expiry: '12/28', holderName: 'Ivan Petrov' })
      .expect(201);
    return res.body.id as string;
  }

  // Заявка -> оффер эксперту, БЕЗ accept — нужно окно до accept, чтобы
  // проверить критичный пуш и SMS-fallback до того, как оффер перестанет
  // быть PENDING.
  async function requestOffer(
    cli: { accessToken: string },
    exp: { accessToken: string },
  ) {
    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
    const offers = await get(exp.accessToken, '/v1/experts/me/offers').expect(
      200,
    );
    expect(offers.body).toHaveLength(1);
    return {
      requestId: r.body.id as string,
      offerId: offers.body[0].offerId as string,
    };
  }

  async function acceptOffer(exp: { accessToken: string }, offerId: string) {
    const accepted = await post(
      exp.accessToken,
      `/v1/offers/${offerId}/accept`,
    ).expect(200);
    return accepted.body.consultationId as string;
  }

  // Полный матч (заявка -> оффер -> accept) — для второго клиента, где
  // SMS-fallback окно не проверяется.
  async function matchClientToExpert(
    cli: { accessToken: string },
    exp: { accessToken: string },
  ) {
    const { requestId, offerId } = await requestOffer(cli, exp);
    const consultationId = await acceptOffer(exp, offerId);
    return { requestId, offerId, consultationId };
  }

  async function pushSentTo(token: string): Promise<any[]> {
    const sent = await redis.lrange(`mockpush:sent:${token}`, 0, -1);
    return sent.map((s) => JSON.parse(s));
  }

  // Устройство может получить несколько пушей за сценарий — ищем именно
  // тот, что относится к проверяемому Notification (как в
  // notifications-domain.e2e-spec.ts).
  function pushForNotification(sent: any[], notificationId: string): any {
    const found = sent.find((s) => s.data?.notificationId === notificationId);
    expect(found).toBeDefined();
    return found;
  }

  it('эксперт (kz, 2 устройства): заявка -> критичный kz-пуш на оба устройства -> без ack -> SMS-fallback -> accept -> оплата -> complete -> earning.credited -> вывод -> payout.paid -> центр (unreadCount/read-all) -> второй клиент отменяет -> consultation.cancelled', async () => {
    // --- Подготовка: эксперт с локалью kz и двумя устройствами -------------
    const exp = await acceptingExpert(PH_E1);
    const expertRow = await prisma.expert.findUniqueOrThrow({
      where: { id: exp.expertId },
    });
    const expertUserId = expertRow.userId;

    // Цена задаётся ДО матчинга — снапшотится в консультацию (money-lifecycle).
    await prisma.expert.update({
      where: { id: exp.expertId },
      data: { priceTiyn: PRICE_TIYN },
    });

    // Первое устройство переключает локаль пользователя на kz; второе без
    // locale — читает уже установленную локаль пользователя, не своё поле.
    await addDevice(exp.accessToken, 'lc-tok-1', 'kz');
    await addDevice(exp.accessToken, 'lc-tok-2');
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: expertUserId } }))
        .locale,
    ).toBe('kz');

    const cli1 = await clientUser(PH_C1);

    // --- Заявка -> критичный kz-пуш на ОБА устройства (БЕЗ accept — нужен -
    // оффер ещё PENDING для проверки SMS-fallback) --------------------------
    const { offerId } = await requestOffer(cli1, exp);

    const pushed1 = await pushSentTo('lc-tok-1');
    const pushed2 = await pushSentTo('lc-tok-2');
    expect(pushed1).toHaveLength(1);
    expect(pushed2).toHaveLength(1);
    for (const push of [pushed1[0], pushed2[0]]) {
      expect(push.critical).toBe(true);
      expect(push.title).toBe('Жаңа өтінім'); // kz, не ru «Новая заявка»
      expect(push.body).toBe('Клиентті қабылдау үшін қосымшаны ашыңыз');
      // PII-инвариант §5.8: ни темы, ни клиента, ни цены в теле пуша.
      expect(push.body).not.toMatch(/anxiety|тревог|price|тиын/i);
    }

    const offerNotification = await prisma.notification.findFirstOrThrow({
      where: { userId: expertUserId, type: 'offer.incoming' },
    });
    expect(offerNotification.data).toMatchObject({ offerId });
    expect(offerNotification.pushSentAt).not.toBeNull();
    expect(offerNotification.smsFallbackAt).toBeNull();

    // --- Без ack за 10с и оффер ещё PENDING -> ровно одно SMS --------------
    fakeClock.advance(11_000);
    await timer.sweep();

    const fallback = sentSms.filter(
      (s) => s.phone === PH_E1 && s.text === SMS_FALLBACK_TEXT,
    );
    expect(fallback).toHaveLength(1);
    expect(
      (
        await prisma.notification.findUniqueOrThrow({
          where: { id: offerNotification.id },
        })
      ).smsFallbackAt,
    ).not.toBeNull();

    // Повторный sweep — SMS не дублируется (идемпотентность fallback).
    await timer.sweep();
    expect(
      sentSms.filter((s) => s.phone === PH_E1 && s.text === SMS_FALLBACK_TEXT),
    ).toHaveLength(1);

    // --- accept -> оплата -----------------------------------------------------
    const consultationId = await acceptOffer(exp, offerId);
    const cardId = await addCard(cli1.accessToken, VISA_PAN);
    await post(cli1.accessToken, `/v1/consultations/${consultationId}/pay`)
      .send({ paymentMethodId: cardId })
      .expect(200);

    // --- complete -> earning.credited эксперту (kz) --------------------------
    await post(exp.accessToken, `/v1/consultations/${consultationId}/complete`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);

    const earningNotification = await prisma.notification.findFirstOrThrow({
      where: { userId: expertUserId, type: 'earning.credited' },
    });
    expect(earningNotification.title).toBe('Есептеу'); // kz, не ru «Начисление»
    expect(earningNotification.body).toContain('12 750'); // NET_TIYN -> ₸
    expect((earningNotification.data as any).amountTiyn).toBe(NET_TIYN);
    expect(earningNotification.pushSentAt).not.toBeNull();

    const earningPush1 = pushForNotification(
      await pushSentTo('lc-tok-1'),
      earningNotification.id,
    );
    const earningPush2 = pushForNotification(
      await pushSentTo('lc-tok-2'),
      earningNotification.id,
    );
    expect(earningPush1.title).toBe('Есептеу');
    expect(earningPush2.title).toBe('Есептеу');

    // --- Вывод -> вебхук paid -> payout.paid эксперту (kz) --------------------
    const payoutRes = await post(exp.accessToken, '/v1/payouts')
      .send({ amountTiyn: PAYOUT_TIYN, ...CARD })
      .expect(201);
    expect(payoutRes.body.status).toBe('PROCESSING'); // в пределах лимита
    const payoutId = payoutRes.body.id as string;
    const payout = await prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
    });

    const webhookBody = {
      eventId: PAYOUT_PAID_EVENT_ID,
      type: 'payout.paid',
      providerRefId: payout.providerRefId,
    };
    await request(app.getHttpServer())
      .post('/v1/webhooks/payouts')
      .set('x-payout-signature', signWebhook(webhookBody))
      .set('Content-Type', 'application/json')
      .send(webhookBody)
      .expect(200);
    expect(
      (await prisma.payout.findUniqueOrThrow({ where: { id: payoutId } }))
        .status,
    ).toBe('PAID');

    const payoutNotification = await prisma.notification.findFirstOrThrow({
      where: { userId: expertUserId, type: 'payout.paid' },
    });
    expect(payoutNotification.title).toBe('Төлем жіберілді'); // kz
    expect(payoutNotification.body).toContain('10 000');
    expect(payoutNotification.body).toContain('**** 1111');
    expect(payoutNotification.pushSentAt).not.toBeNull();

    // --- Центр уведомлений: unreadCount совпадает, read-all обнуляет -------
    const before = await get(
      exp.accessToken,
      '/v1/notifications?take=100',
    ).expect(200);
    const expectedUnreadBefore = await prisma.notification.count({
      where: { userId: expertUserId, readAt: null },
    });
    expect(before.body.unreadCount).toBe(expectedUnreadBefore);
    // offer.incoming, earning.credited, payout.paid — минимум 3 (плюс,
    // возможно, verification.approved из acceptingExpert()).
    expect(expectedUnreadBefore).toBeGreaterThanOrEqual(3);

    await post(exp.accessToken, '/v1/notifications/read').send({}).expect(200);

    const afterReadAll = await get(exp.accessToken, '/v1/notifications').expect(
      200,
    );
    expect(afterReadAll.body.unreadCount).toBe(0);
    expect(afterReadAll.body.items.every((n: any) => n.readAt !== null)).toBe(
      true,
    );

    // --- Второй клиент матчится и отменяет -> consultation.cancelled (kz) ---
    const cli2 = await clientUser(PH_C2);
    const { consultationId: consultationId2 } = await matchClientToExpert(
      cli2,
      exp,
    );

    await post(
      cli2.accessToken,
      `/v1/consultations/${consultationId2}/cancel`,
    ).expect(200);

    const cancelNotification = await prisma.notification.findFirstOrThrow({
      where: { userId: expertUserId, type: 'consultation.cancelled' },
    });
    expect(cancelNotification.title).toBe('Консультация тоқтатылды'); // kz
    expect(cancelNotification.pushSentAt).not.toBeNull();

    // unreadCount после read-all снова совпадает с реальным числом непрочитанных
    // (новый offer.incoming второго матча + consultation.cancelled).
    const finalList = await get(exp.accessToken, '/v1/notifications').expect(
      200,
    );
    const expectedUnreadAfter = await prisma.notification.count({
      where: { userId: expertUserId, readAt: null },
    });
    expect(finalList.body.unreadCount).toBe(expectedUnreadAfter);
    expect(expectedUnreadAfter).toBeGreaterThanOrEqual(2);
  });
});
