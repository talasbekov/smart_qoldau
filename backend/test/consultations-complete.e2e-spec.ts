import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { PresenceService } from '../src/presence/presence.service';
import { ClockService } from '../src/common/clock/clock.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { OfferTimerService } from '../src/requests/offer-timer.service';
import { createApp } from './utils/create-app';
import {
  registeredExpertUser,
  putScheduleAlwaysOn,
} from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Номера спека задачи 5 (E4): завершение консультации с исходом, no-show 3
// мин, отмена клиентом. Не пересекаются с другими спеками эпика.
const PH_E1 = '+77083000001';
const PH_E2 = '+77083000002';
const PH_E3 = '+77083000003';
const PH_E4 = '+77083000004';
const PH_E5 = '+77083000005';
const PH_E6 = '+77083000006';
const PH_E7 = '+77083000007';
const PH_C1 = '+77083000091';
const PH_C2 = '+77083000092';
const PH_C3 = '+77083000093';
const PH_C4 = '+77083000094';
const PH_C5 = '+77083000095';
const PH_C6 = '+77083000096';
const PH_C7 = '+77083000097';
const ALL_PHONES = [
  PH_E1,
  PH_E2,
  PH_E3,
  PH_E4,
  PH_E5,
  PH_E6,
  PH_E7,
  PH_C1,
  PH_C2,
  PH_C3,
  PH_C4,
  PH_C5,
  PH_C6,
  PH_C7,
];

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
// чтобы расписание 24/7 хелперов всегда покрывало now().
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

describe('Завершение консультации, no-show 3 мин, отмена клиентом (E4, задача 5)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  let presence: PresenceService;
  let timer: OfferTimerService;
  const registeredExpertIds: string[] = [];
  const clientUserIds: string[] = [];

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
    if (clientUserIds.length) {
      const abuseKeys = clientUserIds.map((id) => `abuse:client:${id}`);
      await redis.del(...abuseKeys);
    }
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entity: 'request' },
          { entity: 'offer' },
          { entity: 'consultation' },
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
    clientUserIds.length = 0;
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

  // Эквивалент acceptingExpert() из test/utils/expert-helpers.ts, но
  // ОБХОДИТ загрузку документов (verifiedExpert -> upload -> submit ->
  // admin decision): в текущем окружении FileTypeValidator из @nestjs/common
  // (после апгрейда file-type до 20.x) сравнивает MIME-строку вместо
  // расширения и отклоняет валидный PDF (см. spawn_task task_cc6736f8,
  // предсуществующий баг — воспроизводится и на чистом дереве без задачи 5).
  // Здесь напрямую переводим эксперта в VERIFIED через Prisma — задача 5 не
  // про верификацию, важно лишь, что эксперт может быть ACCEPTING.
  async function acceptingExpert(phone: string) {
    const result = await registeredExpertUser(app, phone, () => lastCode);
    registeredExpertIds.push(result.expertId);
    await prisma.expert.update({
      where: { id: result.expertId },
      data: { verificationStatus: 'VERIFIED' },
    });
    await request(app.getHttpServer())
      .patch('/v1/experts/me/work-status')
      .set('Authorization', `Bearer ${result.accessToken}`)
      .send({ workStatus: 'ACCEPTING' })
      .expect(200);
    await putScheduleAlwaysOn(app, result.accessToken);
    return result;
  }

  async function clientUser(phone: string) {
    const result = await clientUserHelper(app, phone, () => lastCode);
    clientUserIds.push(result.userId);
    return result;
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

  it('эксперт завершает консультацию: COMPLETED, сам возвращается в ACCEPTING+presence, durationMin в audit', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const { consultationId } = await matchClientToExpert(cli, exp);

    fakeClock.advance(12 * 60_000); // 12 минут консультации

    const res = await post(
      exp.accessToken,
      `/v1/consultations/${consultationId}/complete`,
    )
      .send({ outcome: 'COMPLETED' })
      .expect(200);
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.outcome).toBe('COMPLETED');

    const row = await prisma.consultation.findUniqueOrThrow({
      where: { id: consultationId },
    });
    expect(row.status).toBe('COMPLETED');
    expect(row.outcome).toBe('COMPLETED');
    expect(row.endedAt).not.toBeNull();

    const expertRow = await prisma.expert.findUniqueOrThrow({
      where: { id: exp.expertId },
    });
    expect(expertRow.workStatus).toBe('ACCEPTING');
    expect(await presence.isAvailable(exp.expertId)).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: {
        entity: 'consultation',
        entityId: consultationId,
        transition: 'consultation.completed',
      },
    });
    expect(audit).not.toBeNull();
    expect(audit!.actorType).toBe('expert');
    expect(audit!.payload).toMatchObject({
      outcome: 'COMPLETED',
      durationMin: 12,
    });
  });

  it('клиент не может завершить консультацию — 403 FORBIDDEN', async () => {
    const exp = await acceptingExpert(PH_E2);
    const cli = await clientUser(PH_C2);
    const { consultationId } = await matchClientToExpert(cli, exp);

    const res = await post(
      cli.accessToken,
      `/v1/consultations/${consultationId}/complete`,
    )
      .send({ outcome: 'COMPLETED' })
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('клиент отменяет ACTIVE консультацию: CANCELLED, abuse-счётчик INCR с TTL, эксперт возвращается ACCEPTING', async () => {
    const exp = await acceptingExpert(PH_E3);
    const cli = await clientUser(PH_C3);
    const { consultationId } = await matchClientToExpert(cli, exp);

    const res = await post(
      cli.accessToken,
      `/v1/consultations/${consultationId}/cancel`,
    ).expect(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.outcome).toBe('CLIENT_CANCELLED');

    const row = await prisma.consultation.findUniqueOrThrow({
      where: { id: consultationId },
    });
    expect(row.status).toBe('CANCELLED');
    expect(row.outcome).toBe('CLIENT_CANCELLED');

    const abuseKey = `abuse:client:${cli.userId}`;
    const count = await redis.get(abuseKey);
    expect(count).toBe('1');
    const ttl = await redis.ttl(abuseKey);
    expect(ttl).toBeGreaterThan(0);

    const expertRow = await prisma.expert.findUniqueOrThrow({
      where: { id: exp.expertId },
    });
    expect(expertRow.workStatus).toBe('ACCEPTING');
    expect(await presence.isAvailable(exp.expertId)).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: {
        entity: 'consultation',
        entityId: consultationId,
        transition: 'consultation.cancelled_by_client',
      },
    });
    expect(audit).not.toBeNull();
    expect(audit!.actorType).toBe('user');
  });

  it('эксперт не может отменить консультацию — 403 FORBIDDEN', async () => {
    const exp = await acceptingExpert(PH_E4);
    const cli = await clientUser(PH_C4);
    const { consultationId } = await matchClientToExpert(cli, exp);

    const res = await post(
      exp.accessToken,
      `/v1/consultations/${consultationId}/cancel`,
    ).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('повторный complete на уже завершённой консультации — 409 CONSULTATION_NOT_ACTIVE', async () => {
    const exp = await acceptingExpert(PH_E5);
    const cli = await clientUser(PH_C5);
    const { consultationId } = await matchClientToExpert(cli, exp);

    await post(exp.accessToken, `/v1/consultations/${consultationId}/complete`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);

    const res = await post(
      exp.accessToken,
      `/v1/consultations/${consultationId}/complete`,
    )
      .send({ outcome: 'COMPLETED' })
      .expect(409);
    expect(res.body.error.code).toBe('CONSULTATION_NOT_ACTIVE');
  });

  it('гонка cancel клиента vs complete эксперта: ровно один 200, консистентный финальный статус', async () => {
    const exp = await acceptingExpert(PH_E6);
    const cli = await clientUser(PH_C6);
    const { consultationId } = await matchClientToExpert(cli, exp);

    const [cancelRes, completeRes] = await Promise.all([
      post(cli.accessToken, `/v1/consultations/${consultationId}/cancel`).then(
        (r) => r,
      ),
      post(exp.accessToken, `/v1/consultations/${consultationId}/complete`)
        .send({ outcome: 'COMPLETED' })
        .then((r) => r),
    ]);

    const statuses = [cancelRes.status, completeRes.status];
    const okCount = statuses.filter((s) => s === 200).length;
    const conflictCount = statuses.filter((s) => s === 409).length;
    expect(okCount).toBe(1);
    expect(conflictCount).toBe(1);

    const row = await prisma.consultation.findUniqueOrThrow({
      where: { id: consultationId },
    });
    // Финальный статус консистентен с тем, чей запрос выиграл гонку.
    if (cancelRes.status === 200) {
      expect(row.status).toBe('CANCELLED');
      expect(row.outcome).toBe('CLIENT_CANCELLED');
    } else {
      expect(row.status).toBe('COMPLETED');
      expect(row.outcome).toBe('COMPLETED');
    }
  });

  it('no-show: клиент не подключился за 3 мин -> sweep помечает noShowNotifiedAt ровно один раз, повторный sweep не дублирует', async () => {
    const exp = await acceptingExpert(PH_E7);
    const cli = await clientUser(PH_C7);
    const { consultationId } = await matchClientToExpert(cli, exp, 'video');

    fakeClock.advance(181_000);
    await timer.sweep();

    const row = await prisma.consultation.findUniqueOrThrow({
      where: { id: consultationId },
    });
    expect(row.noShowNotifiedAt).not.toBeNull();

    const auditCountAfterFirst = await prisma.auditLog.count({
      where: {
        entity: 'consultation',
        entityId: consultationId,
        transition: 'consultation.client_no_show_hint',
      },
    });
    expect(auditCountAfterFirst).toBe(1);

    // Повторный sweep не дублирует audit-запись (идемпотентный гейт
    // noShowNotifiedAt: null).
    await timer.sweep();
    const auditCountAfterSecond = await prisma.auditLog.count({
      where: {
        entity: 'consultation',
        entityId: consultationId,
        transition: 'consultation.client_no_show_hint',
      },
    });
    expect(auditCountAfterSecond).toBe(1);
  });

  it('no-show: клиент подключился (clientJoinedAt проставлен) -> sweep не помечает', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const { consultationId } = await matchClientToExpert(cli, exp, 'audio');

    await prisma.consultation.update({
      where: { id: consultationId },
      data: { clientJoinedAt: fakeClock.now() },
    });

    fakeClock.advance(181_000);
    await timer.sweep();

    const row = await prisma.consultation.findUniqueOrThrow({
      where: { id: consultationId },
    });
    expect(row.noShowNotifiedAt).toBeNull();
  });

  it('no-show: chat-формат не помечается (только audio/video)', async () => {
    const exp = await acceptingExpert(PH_E2);
    const cli = await clientUser(PH_C2);
    const { consultationId } = await matchClientToExpert(cli, exp, 'chat');

    fakeClock.advance(181_000);
    await timer.sweep();

    const row = await prisma.consultation.findUniqueOrThrow({
      where: { id: consultationId },
    });
    expect(row.noShowNotifiedAt).toBeNull();
  });
});
