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
import { seedCandidateHistory } from './utils/matching-helpers';

// Номера спека задачи 9 (E3, финальный сквозной e2e), не пересекаются с
// другими спеками.
const PH_E1 = '+77081000001';
const PH_E2 = '+77081000002';
const PH_E3 = '+77081000003';
const PH_C1 = '+77081000091';
const PH_C2 = '+77081000092';
const ALL_PHONES = [PH_E1, PH_E2, PH_E3, PH_C1, PH_C2];

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

describe('Сквозной e2e матчинга и эскалации: обычный и экстренный путь (E3, задача 9)', () => {
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
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ entity: 'request' }, { entity: 'offer' }],
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
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function acceptingExpert(
    phone: string,
    overrides: {
      topics?: string[];
      formats?: string[];
      acceptsUrgent?: boolean;
    } = {},
  ) {
    const result = await acceptingExpertHelper(app, phone, () => lastCode, {
      topics: overrides.topics,
      formats: overrides.formats,
    });
    registeredExpertIds.push(result.expertId);
    if (overrides.acceptsUrgent) {
      await prisma.expert.update({
        where: { id: result.expertId },
        data: { acceptsUrgent: true },
      });
    }
    return result;
  }

  async function clientUser(phone: string) {
    return clientUserHelper(app, phone, () => lastCode);
  }

  async function offersOf(exp: { accessToken: string }) {
    const res = await get(exp.accessToken, '/v1/experts/me/offers').expect(200);
    return res.body as Array<{ offerId: string }>;
  }

  async function status(cli: { accessToken: string }, requestId: string) {
    const res = await get(cli.accessToken, `/v1/requests/${requestId}`).expect(
      200,
    );
    return res.body;
  }

  it('обычный путь: 2 эксперта → оффер лучшему → таймаут 45с → ротация → accept вторым → MATCHED, audit-цепочка', async () => {
    const e1 = await acceptingExpert(PH_E1);
    const e2 = await acceptingExpert(PH_E2);
    // e1 должен получить оффер первым: даём ему выше score (историю accept),
    // e2 — историю отказов, чтобы он был вторым в очереди кандидатов.
    await seedCandidateHistory(prisma, '+77081100001', e1.expertId, {
      accepted: 5,
    });
    await seedCandidateHistory(prisma, '+77081100002', e2.expertId, {
      declined: 5,
    });

    const cli = await clientUser(PH_C1);
    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
    ownRequestIds.push(r.body.id);

    // Оффер уходит лучшему по скору (e1), не e2.
    const firstOffers = await offersOf(e1);
    expect(firstOffers).toHaveLength(1);
    ownOfferIds.push(firstOffers[0].offerId);
    expect(await offersOf(e2)).toHaveLength(0);

    // Таймаут обычного оффера — 45с (46с гарантированно истекает, presence
    // ещё свежий — advance < 90с).
    fakeClock.advance(46_000);
    await timer.sweep();
    expect(await offersOf(e1)).toHaveLength(0); // TIMEOUT

    // Ротация второму кандидату — e2.
    const secondOffers = await offersOf(e2);
    expect(secondOffers).toHaveLength(1);
    ownOfferIds.push(secondOffers[0].offerId);

    await post(
      e2.accessToken,
      `/v1/offers/${secondOffers[0].offerId}/accept`,
    ).expect(200);

    const st = await status(cli, r.body.id);
    expect(st.status).toBe('MATCHED');
    expect(st.matchedExpert.id).toBe(e2.expertId);

    const fresh = await prisma.request.findUniqueOrThrow({
      where: { id: r.body.id },
    });
    expect(fresh.status).toBe('MATCHED');
    expect(fresh.matchedExpertId).toBe(e2.expertId);

    // Полная audit-цепочка: request.created, offer.sent x2, offer.timeout,
    // offer.accepted, request.matched.
    const requestAudits = await prisma.auditLog.findMany({
      where: { entity: 'request', entityId: r.body.id },
      select: { transition: true },
    });
    expect(requestAudits.map((a) => a.transition)).toEqual(
      expect.arrayContaining(['request.created', 'request.matched']),
    );

    const offerAudits = await prisma.auditLog.findMany({
      where: {
        entity: 'offer',
        entityId: { in: [firstOffers[0].offerId, secondOffers[0].offerId] },
      },
      select: { transition: true },
    });
    const offerTransitions = offerAudits.map((a) => a.transition);
    expect(offerTransitions).toEqual(
      expect.arrayContaining([
        'offer.sent',
        'offer.sent',
        'offer.timeout',
        'offer.accepted',
      ]),
    );
  });

  it('экстренный путь: urgent-оффер 20с таймаут → broadcast 2 мин → без accept → CALLBACK_REQUESTED 5 мин + hotlines', async () => {
    // Единственный urgent-эксперт: получает эксклюзивный оффер, но не
    // принимает его — оффер истекает по 20с-дедлайну.
    const urgent = await acceptingExpert(PH_E1, { acceptsUrgent: true });
    // Регулярный эксперт (без acceptsUrgent), но подходящий по теме/формату —
    // должен получить оффер только на broadcast-круге (после 2 минут).
    const regular = await acceptingExpert(PH_E2, { acceptsUrgent: false });
    const cli = await clientUser(PH_C2);

    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'audio', isEmergency: true })
      .expect(201);
    ownRequestIds.push(r.body.id);

    expect(await offersOf(urgent)).toHaveLength(1);
    expect(await offersOf(regular)).toHaveLength(0);

    // Экстренный дедлайн — 20с (не 45с).
    fakeClock.advance(21_000);
    await timer.sweep(); // urgent TIMEOUT, пул urgent пуст
    expect(await offersOf(urgent)).toHaveLength(0);

    const urgentCand = await prisma.requestCandidate.findFirst({
      where: { requestId: r.body.id, expertId: urgent.expertId },
    });
    expect(urgentCand?.response).toBe('TIMEOUT');

    // До 2 минут ротация идёт только среди acceptsUrgent — регулярный ничего
    // не получает.
    expect(await offersOf(regular)).toHaveLength(0);

    fakeClock.advance(100_000); // итого 121с от создания -> broadcast

    // presence протухает после >90с бездействия — трогаем эксперта
    // непосредственно перед sweep, чтобы он был свежим к моменту broadcast.
    await presence.touch(urgent.expertId);
    await presence.touch(regular.expertId);

    await timer.sweep();

    // Broadcast: регулярный эксперт получил оффер.
    const broadcastOffers = await offersOf(regular);
    expect(broadcastOffers).toHaveLength(1);
    ownOfferIds.push(broadcastOffers[0].offerId);

    let fresh = await prisma.request.findUniqueOrThrow({
      where: { id: r.body.id },
    });
    expect(fresh.status).toBe('SEARCHING');
    expect(fresh.broadcastAt).not.toBeNull();

    const auditBroadcast = await prisma.auditLog.findFirst({
      where: {
        entity: 'request',
        entityId: r.body.id,
        transition: 'request.broadcast',
      },
    });
    expect(auditBroadcast).not.toBeNull();

    // Регулярный эксперт НЕ принимает оффер — доходим до 5 минут от
    // создания. По пути офферы будут TIMEOUT-иться, это нормально.
    fakeClock.advance(180_000); // итого 301с от создания -> callback
    await timer.sweep();

    fresh = await prisma.request.findUniqueOrThrow({
      where: { id: r.body.id },
    });
    expect(fresh.status).toBe('CALLBACK_REQUESTED');
    expect(fresh.closedAt).not.toBeNull();

    const st = await status(cli, r.body.id);
    expect(st.status).toBe('CALLBACK_REQUESTED');
    expect(st.hotlines).toEqual(['150', '103', '112']);

    const auditCallback = await prisma.auditLog.findFirst({
      where: {
        entity: 'request',
        entityId: r.body.id,
        transition: 'request.callback_requested',
      },
    });
    expect(auditCallback).not.toBeNull();

    const pendingLeft = await prisma.requestCandidate.count({
      where: { requestId: r.body.id, response: 'PENDING' },
    });
    expect(pendingLeft).toBe(0);
  });
});
