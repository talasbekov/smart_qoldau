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

// Номера спека задачи 6 (E3), не пересекаются с другими спеками.
const PH_E1 = '+77080000001';
const PH_E2 = '+77080000002';
const PH_E3 = '+77080000003';
const PH_C1 = '+77080000091';
const PH_C2 = '+77080000092';
const PH_C3 = '+77080000093';
const ALL_PHONES = [PH_E1, PH_E2, PH_E3, PH_C1, PH_C2, PH_C3];

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

describe('Экстренная эскалация Р-16: broadcast 2 мин, обратный звонок 5 мин (e2e)', () => {
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

  async function acceptOffer(exp: { accessToken: string; expertId: string }) {
    const offers = await offersOf(exp);
    return post(
      exp.accessToken,
      `/v1/offers/${offers[0].offerId}/accept`,
    ).expect(200);
  }

  it('до 2 мин — только acceptsUrgent; после 2 мин — broadcast всем; первый accept выигрывает', async () => {
    const urgent = await acceptingExpert(PH_E1, { acceptsUrgent: true });
    const regular = await acceptingExpert(PH_E2, { acceptsUrgent: false });
    const cli = await clientUser(PH_C1);

    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'audio', isEmergency: true })
      .expect(201);
    ownRequestIds.push(r.body.id);

    expect(await offersOf(urgent)).toHaveLength(1);
    expect(await offersOf(regular)).toHaveLength(0);

    fakeClock.advance(21_000);
    await timer.sweep(); // urgent TIMEOUT, пул urgent пуст (только он acceptsUrgent)

    // регулярный эксперт всё ещё не должен получить оффер — до 2 минут
    // ротация только среди acceptsUrgent.
    expect(await offersOf(regular)).toHaveLength(0);

    fakeClock.advance(100_000); // итого 121с от создания -> broadcast

    // presence протухает после >90с бездействия — трогаем обоих экспертов
    // непосредственно перед sweep, чтобы они были свежими к моменту broadcast.
    await presence.touch(urgent.expertId);
    await presence.touch(regular.expertId);

    await timer.sweep();

    expect(await offersOf(regular)).toHaveLength(1); // регулярный получил broadcast-оффер

    const fresh = await prisma.request.findUniqueOrThrow({
      where: { id: r.body.id },
    });
    expect(fresh.broadcastAt).not.toBeNull();

    const auditBroadcast = await prisma.auditLog.findFirst({
      where: {
        entity: 'request',
        entityId: r.body.id,
        transition: 'request.broadcast',
      },
    });
    expect(auditBroadcast).not.toBeNull();

    await acceptOffer(regular); // выигрывает

    expect((await status(cli, r.body.id)).status).toBe('MATCHED');
    expect((await status(cli, r.body.id)).matchedExpert.id).toBe(
      regular.expertId,
    );
  });

  it('5 минут без принятия → CALLBACK_REQUESTED + hotlines 150/103/112, офферы REVOKED', async () => {
    const cli = await clientUser(PH_C2);

    // Без экспертов -> заявка создаётся, но NO_EXPERTS выставляется, только
    // если пул кандидатов пуст на момент create; для emergency без
    // acceptsUrgent-экспертов пул пуст сразу, и create() закроет её в
    // NO_EXPERTS, а не оставит SEARCHING. Поэтому заведём одного urgent-
    // эксперта, дадим ему истечь по таймауту, а затем уберём presence,
    // чтобы к моменту 5 минут пул кандидатов оставался пустым при broadcast.
    const urgent = await acceptingExpert(PH_E1, { acceptsUrgent: true });

    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'audio', isEmergency: true })
      .expect(201);
    ownRequestIds.push(r.body.id);
    expect(await offersOf(urgent)).toHaveLength(1);

    fakeClock.advance(21_000);
    await timer.sweep(); // urgent TIMEOUT

    // Эксперт уходит offline перед broadcast -> пул кандидатов на broadcast
    // тоже пуст, PENDING-офферов больше не создаётся.
    await presence.setUnavailable(urgent.expertId);

    fakeClock.advance(100_000); // итого 121с -> broadcast (без кандидатов)
    await timer.sweep();

    let fresh = await prisma.request.findUniqueOrThrow({
      where: { id: r.body.id },
    });
    expect(fresh.status).toBe('SEARCHING');
    expect(fresh.broadcastAt).not.toBeNull();

    fakeClock.advance(180_000); // итого 301с -> callback
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

  it('дедлайн экстренного оффера 20с (не 45)', async () => {
    const urgent = await acceptingExpert(PH_E1, { acceptsUrgent: true });
    const cli = await clientUser(PH_C3);

    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'audio', isEmergency: true })
      .expect(201);
    ownRequestIds.push(r.body.id);

    const offers = await offersOf(urgent);
    expect(offers).toHaveLength(1);
    ownOfferIds.push(offers[0].offerId);

    fakeClock.advance(19_000);
    await timer.sweep();
    expect(await offersOf(urgent)).toHaveLength(1); // ещё не истёк

    fakeClock.advance(2_000); // итого 21с
    await timer.sweep();
    expect(await offersOf(urgent)).toHaveLength(0); // TIMEOUT по 20с

    const cand = await prisma.requestCandidate.findFirst({
      where: { requestId: r.body.id, expertId: urgent.expertId },
    });
    expect(cand?.response).toBe('TIMEOUT');
  });

  it('broadcast: два эксперта, оба accept параллельно → один 200, второй 409/410, заявка MATCHED одним', async () => {
    // Один urgent-эксперт нужен только для того, чтобы create() нашёл ≥1
    // кандидата (иначе заявка сразу закроется в NO_EXPERTS) и заявка осталась
    // SEARCHING до broadcast: его единственный оффер истекает по 20с-
    // дедлайну, дальше urgent-пул пуст, а заявка не закрывается раньше 120с.
    // e1/e2 — обычные (acceptsUrgent: false), недоступны для urgent-ротации;
    // оба становятся кандидатами только на broadcast-круге (полный круг).
    // Сам urgent исключён из broadcast — у него уже есть response (TIMEOUT)
    // этой заявки, поэтому тест проверяет только e1/e2.
    const urgent = await acceptingExpert(PH_E1, { acceptsUrgent: true });
    const e1 = await acceptingExpert(PH_E2, { acceptsUrgent: false });
    const e2 = await acceptingExpert(PH_E3, { acceptsUrgent: false });
    const cli = await clientUser(PH_C1);

    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'audio', isEmergency: true })
      .expect(201);
    ownRequestIds.push(r.body.id);
    expect(await offersOf(urgent)).toHaveLength(1);

    fakeClock.advance(21_000);
    await timer.sweep(); // urgent TIMEOUT, пул urgent пуст

    fakeClock.advance(100_000); // итого 121с -> broadcast, полный круг

    // presence протухает после >90с бездействия — трогаем непосредственно
    // перед sweep, чтобы оба эксперта были свежими к моменту broadcast.
    await presence.touch(e1.expertId);
    await presence.touch(e2.expertId);

    await timer.sweep();

    const offers1 = await offersOf(e1);
    const offers2 = await offersOf(e2);
    // Оба свежих эксперта с БД-допуском получают PENDING-оффер broadcast.
    expect(offers1).toHaveLength(1);
    expect(offers2).toHaveLength(1);

    const [res1, res2] = await Promise.all([
      post(e1.accessToken, `/v1/offers/${offers1[0].offerId}/accept`),
      post(e2.accessToken, `/v1/offers/${offers2[0].offerId}/accept`),
    ]);
    const statuses = [res1.status, res2.status].sort();
    expect(statuses[0]).toBe(200);
    expect([409, 410]).toContain(statuses[1]);

    const fresh = await prisma.request.findUniqueOrThrow({
      where: { id: r.body.id },
    });
    expect(fresh.status).toBe('MATCHED');
  });
});
