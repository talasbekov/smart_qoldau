import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { ClockService } from '../src/common/clock/clock.service';
import { PresenceService } from '../src/presence/presence.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import {
  OfferTimerService,
  OFFERS_DEADLINES_KEY,
  REQUESTS_RESCAN_KEY,
} from '../src/requests/offer-timer.service';
import { createApp } from './utils/create-app';
import { acceptingExpert as acceptingExpertHelper } from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Номера спека задачи 5 (E9, критичный пуш + SMS-fallback), не пересекаются
// с другими спеками.
const PH_E1 = '+77096000001';
const PH_E2 = '+77096000002';
const PH_E3 = '+77096000003';
const PH_C1 = '+77096000091';
const PH_C2 = '+77096000092';
const PH_C3 = '+77096000093';
const PH_C4 = '+77096000094';
const PH_C5 = '+77096000095';
const PH_C6 = '+77096000096';
const ALL_PHONES = [
  PH_E1,
  PH_E2,
  PH_E3,
  PH_C1,
  PH_C2,
  PH_C3,
  PH_C4,
  PH_C5,
  PH_C6,
];

const SMS_FALLBACK_TEXT = 'SmartQoldau: новая заявка, откройте приложение';

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
// как в request-timers.e2e-spec.ts (тот же sweep).
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

describe('Критичный пуш входящей заявки + SMS-fallback 10с, виртуальное время (e2e)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  let presence: PresenceService;
  let timer: OfferTimerService;
  const registeredExpertIds: string[] = [];
  const ownRequestIds: string[] = [];
  const ownOfferIds: string[] = [];

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
    if (ownOfferIds.length) {
      await redis.zrem(OFFERS_DEADLINES_KEY, ...ownOfferIds);
    }
    if (ownRequestIds.length) {
      await redis.zrem(REQUESTS_RESCAN_KEY, ...ownRequestIds);
    }
    await prisma.notification.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.device.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entity: 'request' },
          { entity: 'offer' },
          { entity: 'notification' },
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
      where: { entityId: { in: [...userIds, ...expertIds] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    const keys = await redis.keys('mockpush:*');
    if (keys.length) await redis.del(...keys);
    registeredExpertIds.length = 0;
    ownRequestIds.length = 0;
    ownOfferIds.length = 0;
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
    presence = app.get(PresenceService);
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

  async function registerDevice(accessToken: string, token: string) {
    await request(app.getHttpServer())
      .post('/v1/devices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ platform: 'android', token })
      .expect(201);
  }

  async function createRequest(
    accessToken: string,
    overrides: Record<string, unknown> = {},
  ) {
    return request(app.getHttpServer())
      .post('/v1/requests')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ topicSlug: 'anxiety-stress', format: 'video', ...overrides })
      .expect(201);
  }

  async function offersOf(exp: { accessToken: string }) {
    const res = await request(app.getHttpServer())
      .get('/v1/experts/me/offers')
      .set('Authorization', `Bearer ${exp.accessToken}`)
      .expect(200);
    return res.body as Array<{ offerId: string }>;
  }

  async function offerNotificationOf(expertId: string) {
    const expertRow = await prisma.expert.findUniqueOrThrow({
      where: { id: expertId },
    });
    return prisma.notification.findFirstOrThrow({
      where: { userId: expertRow.userId, type: 'offer.incoming' },
    });
  }

  function fallbackSmsTo(phone: string) {
    return sentSms.filter(
      (s) => s.phone === phone && s.text === SMS_FALLBACK_TEXT,
    );
  }

  it('оффер создан -> критичный пуш в мок (critical=true, без PII) + Notification offer.incoming', async () => {
    const e1 = await acceptingExpert(PH_E1);
    await registerDevice(e1.accessToken, 'fb-tok-1');
    const cli = await clientUser(PH_C1);

    const r = await createRequest(cli.accessToken);
    ownRequestIds.push(r.body.id);

    const offers = await offersOf(e1);
    expect(offers).toHaveLength(1);
    ownOfferIds.push(offers[0].offerId);

    const sent = await redis.lrange('mockpush:sent:fb-tok-1', 0, -1);
    expect(sent).toHaveLength(1);
    const record = JSON.parse(sent[0]);
    expect(record.critical).toBe(true);
    expect(record.title).toBe('Новая заявка');
    // PII-инвариант §5.8: никаких тем/клиентов/цен в теле пуша.
    expect(record.body).not.toMatch(/anxiety|тревог/i);

    const notification = await offerNotificationOf(e1.expertId);
    expect(notification.data).toMatchObject({
      offerId: offers[0].offerId,
      requestId: r.body.id,
    });
    expect(notification.pushSentAt).not.toBeNull();
    expect(notification.smsFallbackAt).toBeNull();
  });

  it('без ack за 10с и оффер ещё PENDING -> ровно одно SMS + smsFallbackAt + audit; повторный sweep не дублирует', async () => {
    const e1 = await acceptingExpert(PH_E1);
    await registerDevice(e1.accessToken, 'fb-tok-2');
    const cli = await clientUser(PH_C2);

    const r = await createRequest(cli.accessToken);
    ownRequestIds.push(r.body.id);
    const offers = await offersOf(e1);
    ownOfferIds.push(offers[0].offerId);

    fakeClock.advance(11_000);
    await timer.sweep();

    expect(fallbackSmsTo(PH_E1)).toHaveLength(1);

    const notification = await offerNotificationOf(e1.expertId);
    expect(notification.smsFallbackAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: {
        entity: 'notification',
        entityId: notification.id,
        transition: 'notification.sms_fallback',
      },
    });
    expect(audit).not.toBeNull();

    // Повторный sweep — SMS не дублируется (идемпотентность).
    await timer.sweep();
    expect(fallbackSmsTo(PH_E1)).toHaveLength(1);
  });

  it('ack за 10с -> sweep не шлёт SMS', async () => {
    const e1 = await acceptingExpert(PH_E1);
    await registerDevice(e1.accessToken, 'fb-tok-3');
    const cli = await clientUser(PH_C3);

    const r = await createRequest(cli.accessToken);
    ownRequestIds.push(r.body.id);
    const offers = await offersOf(e1);
    ownOfferIds.push(offers[0].offerId);

    const notification = await offerNotificationOf(e1.expertId);
    await request(app.getHttpServer())
      .post(`/v1/notifications/${notification.id}/ack`)
      .set('Authorization', `Bearer ${e1.accessToken}`)
      .expect(200);

    fakeClock.advance(11_000);
    await timer.sweep();

    expect(fallbackSmsTo(PH_E1)).toHaveLength(0);
    const fresh = await prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
    expect(fresh.smsFallbackAt).toBeNull();
  });

  it('оффер уже не PENDING (TIMEOUT по дедлайну 45с) до fallback -> SMS нет, smsFallbackAt проставлен без SMS', async () => {
    const e1 = await acceptingExpert(PH_E1);
    await registerDevice(e1.accessToken, 'fb-tok-4');
    const cli = await clientUser(PH_C4);

    const r = await createRequest(cli.accessToken);
    ownRequestIds.push(r.body.id);
    const offers = await offersOf(e1);
    ownOfferIds.push(offers[0].offerId);

    // 46с: дедлайн оффера (45с) и окно fallback (10с) оба истекли. Шаг 1
    // sweep() обрабатывает TIMEOUT раньше шага 8 (fallback) в том же тике.
    fakeClock.advance(46_000);
    await timer.sweep();

    expect(fallbackSmsTo(PH_E1)).toHaveLength(0);

    const notification = await offerNotificationOf(e1.expertId);
    expect(notification.smsFallbackAt).not.toBeNull();

    const cand = await prisma.requestCandidate.findUniqueOrThrow({
      where: { id: offers[0].offerId },
    });
    expect(cand.response).toBe('TIMEOUT');
  });

  it('эскалация Р-16 (broadcast) тоже диспатчит критичный пуш', async () => {
    // urgent нужен только чтобы create() не закрыл заявку в NO_EXPERTS сразу
    // (пул кандидатов на момент create не пуст) — его оффер истекает по
    // 20с-дедлайну, дальше urgent-пул пуст. regular (acceptsUrgent: false)
    // получает оффер только на broadcast-круге (полный круг после 120с).
    const urgent = await acceptingExpert(PH_E1);
    await prisma.expert.update({
      where: { id: urgent.expertId },
      data: { acceptsUrgent: true },
    });
    const regular = await acceptingExpert(PH_E2);
    await registerDevice(regular.accessToken, 'fb-tok-5');
    const cli = await clientUser(PH_C5);

    const r = await createRequest(cli.accessToken, { isEmergency: true });
    ownRequestIds.push(r.body.id);
    expect(await offersOf(urgent)).toHaveLength(1);

    fakeClock.advance(21_000);
    await timer.sweep(); // urgent TIMEOUT, urgent-пул пуст

    expect(await offersOf(regular)).toHaveLength(0);

    fakeClock.advance(100_000); // итого 121с от создания -> broadcast
    // presence протухает после >90с бездействия — освежаем перед sweep.
    await presence.touch(urgent.expertId);
    await presence.touch(regular.expertId);
    await timer.sweep();

    const offers = await offersOf(regular);
    expect(offers).toHaveLength(1);
    ownOfferIds.push(offers[0].offerId);

    const sent = await redis.lrange('mockpush:sent:fb-tok-5', 0, -1);
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0]).critical).toBe(true);

    const notification = await offerNotificationOf(regular.expertId);
    expect(notification.data).toMatchObject({
      offerId: offers[0].offerId,
      requestId: r.body.id,
    });
  });

  it('оффер REVOKED (accept сиблинг-оффера того же broadcast) до fallback -> SMS нет, smsFallbackAt проставлен без SMS', async () => {
    // Реальный доменный путь REVOKED (не ручной prisma.update): broadcast
    // Р-16 — единственный случай в системе, когда у заявки одновременно
    // больше одного PENDING-оффера (см. комментарий в EscalationService) —
    // рассылает PENDING сразу ДВУМ regular-экспертам одной emergency-заявки;
    // accept одного из них ревокирует PENDING остальных
    // (RequestsService.revokeOtherPendingOffers), см. requests.service.ts.
    const urgent = await acceptingExpert(PH_E1);
    await prisma.expert.update({
      where: { id: urgent.expertId },
      data: { acceptsUrgent: true },
    });
    const regularA = await acceptingExpert(PH_E2);
    const regularB = await acceptingExpert(PH_E3);
    await registerDevice(regularB.accessToken, 'fb-tok-6');
    const cli = await clientUser(PH_C6);

    const r = await createRequest(cli.accessToken, { isEmergency: true });
    ownRequestIds.push(r.body.id);
    expect(await offersOf(urgent)).toHaveLength(1);

    fakeClock.advance(21_000);
    await timer.sweep(); // urgent TIMEOUT, urgent-пул пуст

    fakeClock.advance(100_000); // итого 121с от создания -> broadcast
    // presence протухает после >90с бездействия — освежаем перед sweep.
    await presence.touch(urgent.expertId);
    await presence.touch(regularA.expertId);
    await presence.touch(regularB.expertId);
    await timer.sweep();

    const offersA = await offersOf(regularA);
    const offersB = await offersOf(regularB);
    expect(offersA).toHaveLength(1);
    expect(offersB).toHaveLength(1);
    ownOfferIds.push(offersA[0].offerId, offersB[0].offerId);

    // regularA принимает свой оффер -> сиблинг-оффер regularB той же
    // заявки ревокируется реальным доменным путём (не PENDING -> fallback
    // не должен слать SMS).
    await request(app.getHttpServer())
      .post(`/v1/offers/${offersA[0].offerId}/accept`)
      .set('Authorization', `Bearer ${regularA.accessToken}`)
      .expect(200);

    const revokedOffer = await prisma.requestCandidate.findUniqueOrThrow({
      where: { id: offersB[0].offerId },
    });
    expect(revokedOffer.response).toBe('REVOKED');

    // Notification regularB создана при broadcast (до accept regularA) и
    // не подтверждена ack — fallback-окно 10с истекает уже ПОСЛЕ revoke.
    fakeClock.advance(11_000);
    await timer.sweep();

    expect(fallbackSmsTo(PH_E3)).toHaveLength(0);

    const notification = await offerNotificationOf(regularB.expertId);
    expect(notification.smsFallbackAt).not.toBeNull();
  });
});
