import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { ClockService } from '../src/common/clock/clock.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import {
  OfferTimerService,
  OFFERS_DEADLINES_KEY,
  REQUESTS_RESCAN_KEY,
} from '../src/requests/offer-timer.service';
import { AuditService } from '../src/audit/audit.service';
import { RequestsService } from '../src/requests/requests.service';
import { createApp } from './utils/create-app';
import { acceptingExpert as acceptingExpertHelper } from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';
import { seedCandidateHistory } from './utils/matching-helpers';

// Номера спека задачи 5 (E3), не пересекаются с другими спеками.
const PH_E1 = '+77079000001';
const PH_E2 = '+77079000002';
const PH_E3 = '+77079000003';
const PH_C1 = '+77079000091';
const PH_C2 = '+77079000092';
const PH_C3 = '+77079000093';
const PH_C4 = '+77079000094';
const ALL_PHONES = [PH_E1, PH_E2, PH_E3, PH_C1, PH_C2, PH_C3, PH_C4];

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

// Виртуальные часы: старт в среду 2026-08-20 10:00 Asia/Almaty (05:00 UTC),
// чтобы расписание 24/7 хелперов (acceptingExpert -> putScheduleAlwaysOn)
// всегда покрывало now(). advance() двигает и дедлайны офферов
// (RequestsService.offerToNext считает их от ClockService.now()), и
// createdAt заявок, и presence lastseen (PresenceService.touch пишет от
// ClockService.now()) — поэтому после больших advance() эксперты «протухают»
// в presence (stale > 90с) и требуют повторного touch/re-setAvailable.
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

describe('Дедлайны офферов на Redis ZSET + sweep, виртуальное время (e2e)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
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

  async function offersOf(exp: { accessToken: string }) {
    const res = await get(exp.accessToken, '/v1/experts/me/offers').expect(200);
    return res.body as Array<{ offerId: string }>;
  }

  it('оффер истекает через 45с: TIMEOUT и ротация следующему; эмердженси — через 20с', async () => {
    const e1 = await acceptingExpert(PH_E1);
    const e2 = await acceptingExpert(PH_E2);
    // e1 должен получить оффер первым: даём ему выше score (историю accept).
    await seedCandidateHistory(prisma, '+77079100001', e1.expertId, {
      accepted: 5,
    });
    await seedCandidateHistory(prisma, '+77079100002', e2.expertId, {
      declined: 5,
    });

    const cli = await clientUser(PH_C1);
    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
    ownRequestIds.push(r.body.id);

    const firstOffers = await offersOf(e1);
    expect(firstOffers).toHaveLength(1);
    ownOfferIds.push(firstOffers[0].offerId);

    fakeClock.advance(44_000);
    await timer.sweep();
    expect(await offersOf(e1)).toHaveLength(1); // ещё не истёк (< 45с)

    fakeClock.advance(2_000); // итого 46с
    await timer.sweep();
    expect(await offersOf(e1)).toHaveLength(0); // TIMEOUT

    const secondOffers = await offersOf(e2);
    expect(secondOffers).toHaveLength(1); // ротация следующему
    ownOfferIds.push(secondOffers[0].offerId);

    const cand = await prisma.requestCandidate.findFirst({
      where: { requestId: r.body.id, expertId: e1.expertId },
    });
    expect(cand?.response).toBe('TIMEOUT');
  });

  it('эмердженси-оффер истекает через 20с (не 45с)', async () => {
    const e1 = await acceptingExpert(PH_E1);
    await prisma.expert.update({
      where: { id: e1.expertId },
      data: { acceptsUrgent: true },
    });
    const cli = await clientUser(PH_C1);

    const r = await post(cli.accessToken, '/v1/requests')
      .send({
        topicSlug: 'anxiety-stress',
        format: 'video',
        isEmergency: true,
      })
      .expect(201);
    ownRequestIds.push(r.body.id);

    const firstOffers = await offersOf(e1);
    expect(firstOffers).toHaveLength(1);
    ownOfferIds.push(firstOffers[0].offerId);

    fakeClock.advance(19_000);
    await timer.sweep();
    expect(await offersOf(e1)).toHaveLength(1); // ещё не истёк (< 20с)

    fakeClock.advance(2_000); // итого 21с
    await timer.sweep();
    expect(await offersOf(e1)).toHaveLength(0); // TIMEOUT по 20с-дедлайну

    const cand = await prisma.requestCandidate.findFirst({
      where: { requestId: r.body.id, expertId: e1.expertId },
    });
    expect(cand?.response).toBe('TIMEOUT');

    // Эскалация emergency-заявок — задача 6; sweep НЕ закрывает их в
    // NO_EXPERTS даже спустя 120с — они остаются SEARCHING.
    fakeClock.advance(120_000);
    await timer.sweep();
    const fresh = await prisma.request.findUniqueOrThrow({
      where: { id: r.body.id },
    });
    expect(fresh.status).toBe('SEARCHING');
  });

  it('обычная заявка: 2 минуты без принятия -> NO_EXPERTS (пул исчерпан и по таймауту)', async () => {
    const e1 = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C2);

    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
    ownRequestIds.push(r.body.id);
    expect(r.body.status).toBe('SEARCHING');

    const offers = await offersOf(e1);
    expect(offers).toHaveLength(1);
    ownOfferIds.push(offers[0].offerId);

    // 46с -> оффер истекает; единственный эксперт -> пул пуст -> рескан
    // запланирован (заявке ещё < 120с).
    fakeClock.advance(46_000);
    await timer.sweep();
    let fresh = await prisma.request.findUniqueOrThrow({
      where: { id: r.body.id },
    });
    expect(fresh.status).toBe('SEARCHING');

    // Двигаемся до общего возраста >= 120с. Протухание presence эксперта
    // тут не важно — суть теста именно в том, что пул остаётся пуст.
    fakeClock.advance(75_000); // итого 121с от создания
    await timer.sweep();

    fresh = await prisma.request.findUniqueOrThrow({
      where: { id: r.body.id },
    });
    expect(fresh.status).toBe('NO_EXPERTS');
    expect(fresh.closedAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: {
        entity: 'request',
        entityId: r.body.id,
        transition: 'request.no_experts',
      },
    });
    expect(audit).not.toBeNull();
  });

  it('accept снимает дедлайн: после accept sweep с advance(60с) ничего не ротирует', async () => {
    const e1 = await acceptingExpert(PH_E1);
    const e2 = await acceptingExpert(PH_E2);
    const cli = await clientUser(PH_C3);

    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
    ownRequestIds.push(r.body.id);

    const e1Offers = await offersOf(e1);
    const holder = e1Offers.length ? e1 : e2;
    const holderOffers = e1Offers.length ? e1Offers : await offersOf(e2);
    const offerId = holderOffers[0].offerId;

    await post(holder.accessToken, `/v1/offers/${offerId}/accept`).expect(200);

    const scoreBeforeAdvance = await redis.zscore(
      OFFERS_DEADLINES_KEY,
      offerId,
    );
    expect(scoreBeforeAdvance).toBeNull();

    fakeClock.advance(60_000);
    const processed = await timer.sweep();
    expect(processed).toBe(0);

    const fresh = await prisma.request.findUniqueOrThrow({
      where: { id: r.body.id },
    });
    expect(fresh.status).toBe('MATCHED');

    const score = await redis.zscore(OFFERS_DEADLINES_KEY, offerId);
    expect(score).toBeNull();
  });

  it('изоляция ошибок sweep: сбой offerToNext на одном оффере не мешает второму; упавшая заявка получает рескан', async () => {
    // Два эксперта с разными темами -> два независимых оффера двух заявок.
    const e1 = await acceptingExpert(PH_E1, { topics: ['anxiety-stress'] });
    const e2 = await acceptingExpert(PH_E2, { topics: ['burnout'] });
    const cli1 = await clientUser(PH_C1);
    const cli2 = await clientUser(PH_C2);

    const r1 = await post(cli1.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
    const r2 = await post(cli2.accessToken, '/v1/requests')
      .send({ topicSlug: 'burnout', format: 'video' })
      .expect(201);
    ownRequestIds.push(r1.body.id, r2.body.id);

    const offers1 = await offersOf(e1);
    const offers2 = await offersOf(e2);
    expect(offers1).toHaveLength(1);
    expect(offers2).toHaveLength(1);
    ownOfferIds.push(offers1[0].offerId, offers2[0].offerId);

    // Мок: ротация первой заявки падает, второй — успешна.
    const requestsService = app.get(RequestsService);
    const spy = jest
      .spyOn(requestsService, 'offerToNext')
      .mockImplementation(async (requestId: string) => {
        if (requestId === r1.body.id) throw new Error('transient db error');
        return true;
      });

    try {
      fakeClock.advance(46_000);
      // Не бросает наружу; оба истёкших оффера обработаны.
      const processed = await timer.sweep();
      expect(processed).toBe(2);
    } finally {
      spy.mockRestore();
    }

    // Оба оффера получили TIMEOUT, дедлайны сняты из ZSET.
    for (const offerId of [offers1[0].offerId, offers2[0].offerId]) {
      const cand = await prisma.requestCandidate.findUniqueOrThrow({
        where: { id: offerId },
      });
      expect(cand.response).toBe('TIMEOUT');
      expect(await redis.zscore(OFFERS_DEADLINES_KEY, offerId)).toBeNull();
    }

    // Упавшая заявка не зависла: для неё запланирован рескан.
    const rescan1 = await redis.zscore(REQUESTS_RESCAN_KEY, r1.body.id);
    expect(rescan1).not.toBeNull();
    // Успешная ротация второй заявки рескана не требует.
    const rescan2 = await redis.zscore(REQUESTS_RESCAN_KEY, r2.body.id);
    expect(rescan2).toBeNull();
  });

  it('рестарт-устойчивость: schedule -> новый инстанс OfferTimerService -> sweep видит дедлайн из Redis', async () => {
    const e1 = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C4);

    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
    ownRequestIds.push(r.body.id);

    const offers = await offersOf(e1);
    expect(offers).toHaveLength(1);
    const offerId = offers[0].offerId;
    ownOfferIds.push(offerId);

    const scoreBefore = await redis.zscore(OFFERS_DEADLINES_KEY, offerId);
    expect(scoreBefore).not.toBeNull();

    // «Рестарт»: новый инстанс OfferTimerService с теми же зависимостями из
    // DI-контейнера приложения. Данные о дедлайне живут в Redis ZSET, а не в
    // памяти прежнего инстанса — новый инстанс обязан их увидеть.
    const clock = app.get(ClockService);
    const prismaSvc = app.get(PrismaService);
    const audit = app.get(AuditService);
    const requestsService = app.get(RequestsService);
    const restartedTimer = new OfferTimerService(
      redis,
      clock,
      prismaSvc,
      audit,
      requestsService,
    );

    fakeClock.advance(46_000);
    const processed = await restartedTimer.sweep();
    expect(processed).toBeGreaterThanOrEqual(1);

    const scoreAfter = await redis.zscore(OFFERS_DEADLINES_KEY, offerId);
    expect(scoreAfter).toBeNull();

    const cand = await prisma.requestCandidate.findUniqueOrThrow({
      where: { id: offerId },
    });
    expect(cand.response).toBe('TIMEOUT');
  });
});
