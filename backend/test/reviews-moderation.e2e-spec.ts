import {
  holdConsultation,
  cleanupPaidConsultations,
} from './utils/paid-consultation';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { ClockService } from '../src/common/clock/clock.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import {
  registeredExpertUser,
  putScheduleAlwaysOn,
} from './utils/expert-helpers';
import {
  clientUser as clientUserHelper,
  guestClient,
} from './utils/client-helpers';
import { adminUser, AdminAuth } from './utils/admin-helpers';

// Номера спека задачи 8 (E4): ответы эксперта, жалобы, админ-модерация.
// Не пересекаются с задачей 7 (+7708400000[1-9]/1[01]/1[00-02]).
const PH_E1 = '+77085000001';
const PH_E2 = '+77085000002';
const PH_E3 = '+77085000003';
const PH_E4 = '+77085000004';
const PH_E5 = '+77085000005';
const PH_E6 = '+77085000006';
const PH_E7 = '+77085000007';
const PH_E8 = '+77085000009';
const PH_ESTRANGER = '+77085000008';
const PH_C1 = '+77085000091';
const PH_C2 = '+77085000092';
const PH_C3 = '+77085000093';
const PH_C4 = '+77085000094';
const PH_C5 = '+77085000095';
const PH_C6 = '+77085000096';
const PH_C7 = '+77085000097';
const PH_C8 = '+77085000098';
const ALL_PHONES = [
  PH_E1,
  PH_E2,
  PH_E3,
  PH_E4,
  PH_E5,
  PH_E6,
  PH_E7,
  PH_E8,
  PH_ESTRANGER,
  PH_C1,
  PH_C2,
  PH_C3,
  PH_C4,
  PH_C5,
  PH_C6,
  PH_C7,
  PH_C8,
];

// Префикс-метка этого спека (E8a, задача 5): admin_users и гостевые
// устройства могут содержать строки от прошлых прогонов — спек не
// предполагает пустоты этих таблиц и убирает только свои строки.
const ADMIN_EMAIL_PREFIX = 'reviews-moderation-e2e-';
const GUEST_DEVICE_PREFIX = 'reviews-moderation-e2e-guest-';
const DUMMY_ID = '00000000-0000-0000-0000-000000000000';

let adminEmailSeq = 0;
function uniqueAdminEmail(tag: string): string {
  return `${ADMIN_EMAIL_PREFIX}${tag}-${Date.now()}-${adminEmailSeq++}@smartqoldau.kz`;
}

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
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

describe('Ответы эксперта, жалобы, админ-модерация отзывов (E4, задача 8)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  const registeredExpertIds: string[] = [];
  const clientUserIds: string[] = [];

  async function cleanup() {
    await cleanupPaidConsultations(app);
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
          { entity: 'review' },
          { entity: 'expert', entityId: { in: expertIds } },
        ],
      },
    });
    await prisma.review.deleteMany({
      where: {
        OR: [
          { expertId: { in: expertIds } },
          { clientUserId: { in: userIds } },
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

    const guests = await prisma.user.findMany({
      where: { deviceId: { startsWith: GUEST_DEVICE_PREFIX } },
      select: { id: true },
    });
    const guestIds = guests.map((u) => u.id);
    if (guestIds.length) {
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: guestIds } },
      });
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: guestIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: guestIds } } });
    }

    await prisma.adminUser.deleteMany({
      where: { email: { startsWith: ADMIN_EMAIL_PREFIX } },
    });
  }

  let qualityAuth: AdminAuth;

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
  });

  beforeEach(async () => {
    fakeClock.current = new Date('2026-08-20T05:00:00Z');
    await cleanup();
    qualityAuth = await adminUser(
      app,
      [AdminRole.QUALITY_TEAM],
      uniqueAdminEmail('quality'),
    );
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

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

  async function matchAndReview(
    cli: { accessToken: string },
    exp: { accessToken: string; expertId: string },
    rating = 3,
    privateText?: string,
  ) {
    const r = await post(cli.accessToken, '/v1/requests')
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
    await holdConsultation(app, consultationId);
    await post(exp.accessToken, `/v1/consultations/${consultationId}/complete`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);
    const review = await post(
      cli.accessToken,
      `/v1/consultations/${consultationId}/review`,
    )
      .send({
        rating,
        publicText: 'Отзыв на модерацию',
        privateText,
      })
      .expect(201);
    void r;
    return review.body.id as string;
  }

  it('reply эксперта: виден в публичной выдаче (expertReply), повтор перезаписывает', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const reviewId = await matchAndReview(cli, exp, 5);

    await post(exp.accessToken, `/v1/reviews/${reviewId}/reply`)
      .send({ text: 'Спасибо за отзыв!' })
      .expect(200);

    const list1 = await request(app.getHttpServer())
      .get(`/v1/experts/${exp.expertId}/reviews`)
      .expect(200);
    expect(list1.body.items[0].expertReply).toBe('Спасибо за отзыв!');

    await post(exp.accessToken, `/v1/reviews/${reviewId}/reply`)
      .send({ text: 'Обновлённый ответ' })
      .expect(200);

    const list2 = await request(app.getHttpServer())
      .get(`/v1/experts/${exp.expertId}/reviews`)
      .expect(200);
    expect(list2.body.items[0].expertReply).toBe('Обновлённый ответ');

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'review', transition: 'review.replied' },
    });
    expect(audit).not.toBeNull();
  });

  it('reply на чужой отзыв -> 404 REVIEW_NOT_FOUND', async () => {
    const exp = await acceptingExpert(PH_E2);
    const cli = await clientUser(PH_C2);
    const reviewId = await matchAndReview(cli, exp, 4);

    const stranger = await acceptingExpert(PH_ESTRANGER);
    const res = await post(
      stranger.accessToken,
      `/v1/reviews/${reviewId}/reply`,
    )
      .send({ text: 'Это не мой отзыв' })
      .expect(404);
    expect(res.body.error.code).toBe('REVIEW_NOT_FOUND');
  });

  it('complaint: отзыв исчезает из публичной выдачи, ratingCount уменьшился; повторная жалоба -> 409', async () => {
    const exp = await acceptingExpert(PH_E3);
    const cli = await clientUser(PH_C3);
    const reviewId = await matchAndReview(cli, exp, 2);

    const before = await request(app.getHttpServer())
      .get(`/v1/experts/${exp.expertId}/reviews`)
      .expect(200);
    expect(before.body.items).toHaveLength(1);
    expect(before.body.ratingCount).toBe(1);

    await post(exp.accessToken, `/v1/reviews/${reviewId}/complaint`)
      .send({ text: 'Отзыв необоснован' })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/v1/experts/${exp.expertId}/reviews`)
      .expect(200);
    expect(after.body.items).toHaveLength(0);
    expect(after.body.ratingCount).toBe(0);

    const expertRow = await prisma.expert.findUniqueOrThrow({
      where: { id: exp.expertId },
    });
    expect(expertRow.ratingCount).toBe(0);

    const auditFlag = await prisma.auditLog.findFirst({
      where: { entity: 'review', transition: 'review.flagged' },
    });
    expect(auditFlag).not.toBeNull();

    const res2 = await post(
      exp.accessToken,
      `/v1/reviews/${reviewId}/complaint`,
    )
      .send({ text: 'Ещё раз' })
      .expect(409);
    expect(res2.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('reply на FLAGGED-отзыв -> 409', async () => {
    const exp = await acceptingExpert(PH_E4);
    const cli = await clientUser(PH_C4);
    const reviewId = await matchAndReview(cli, exp, 1);

    await post(exp.accessToken, `/v1/reviews/${reviewId}/complaint`)
      .send({ text: 'Жалоба' })
      .expect(200);

    const res = await post(exp.accessToken, `/v1/reviews/${reviewId}/reply`)
      .send({ text: 'Ответ на скрытый отзыв' })
      .expect(409);
    expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('админ: restore возвращает FLAGGED-отзыв в выдачу и пересчитывает рейтинг обратно', async () => {
    const exp = await acceptingExpert(PH_E5);
    const cli = await clientUser(PH_C5);
    const reviewId = await matchAndReview(
      cli,
      exp,
      4,
      'СЕКРЕТНЫЙ ТЕКСТ ДЛЯ КОМАНДЫ КАЧЕСТВА',
    );

    await post(exp.accessToken, `/v1/reviews/${reviewId}/complaint`)
      .send({ text: 'Жалоба на отзыв' })
      .expect(200);

    const flaggedList = await request(app.getHttpServer())
      .get('/v1/admin/reviews/flagged')
      .set(...qualityAuth.authHeader)
      .expect(200);
    const flagged = flaggedList.body.find(
      (r: { id: string }) => r.id === reviewId,
    );
    expect(flagged).toBeDefined();
    expect(flagged.privateText).toBe('СЕКРЕТНЫЙ ТЕКСТ ДЛЯ КОМАНДЫ КАЧЕСТВА');
    expect(flagged.complaint).toBe('Жалоба на отзыв');
    expect(flagged.expertId).toBe(exp.expertId);

    await request(app.getHttpServer())
      .post(`/v1/admin/reviews/${reviewId}/resolve`)
      .set(...qualityAuth.authHeader)
      .send({ action: 'restore', comment: 'Отзыв корректен' })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/v1/experts/${exp.expertId}/reviews`)
      .expect(200);
    expect(after.body.items).toHaveLength(1);
    expect(after.body.ratingCount).toBe(1);
    expect(after.body.ratingAvg).toBe(4);

    const auditRestored = await prisma.auditLog.findFirst({
      where: { entity: 'review', transition: 'review.restored' },
    });
    expect(auditRestored).not.toBeNull();
    expect(auditRestored!.payload).toMatchObject({
      comment: 'Отзыв корректен',
    });
    expect(auditRestored!.actorId).toBe(qualityAuth.id);
  });

  it('админ: hide оставляет отзыв скрытым, агрегаты без него; privateText только в админ-выдаче', async () => {
    const exp = await acceptingExpert(PH_E6);
    const cli = await clientUser(PH_C6);
    const reviewId = await matchAndReview(cli, exp, 1, 'ПРИВАТНЫЙ КОММЕНТАРИЙ');

    await post(exp.accessToken, `/v1/reviews/${reviewId}/complaint`)
      .send({ text: 'Прошу разобраться' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/v1/admin/reviews/${reviewId}/resolve`)
      .set(...qualityAuth.authHeader)
      .send({ action: 'hide', comment: 'Подтверждено нарушение' })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/v1/experts/${exp.expertId}/reviews`)
      .expect(200);
    expect(after.body.items).toHaveLength(0);
    expect(after.body.ratingCount).toBe(0);
    expect(JSON.stringify(after.body)).not.toContain('ПРИВАТНЫЙ КОММЕНТАРИЙ');

    const review = await prisma.review.findUniqueOrThrow({
      where: { id: reviewId },
    });
    expect(review.status).toBe('HIDDEN');

    const auditHidden = await prisma.auditLog.findFirst({
      where: { entity: 'review', transition: 'review.hidden' },
    });
    expect(auditHidden).not.toBeNull();
    expect(auditHidden!.payload).toMatchObject({
      comment: 'Подтверждено нарушение',
    });
    expect(auditHidden!.actorId).toBe(qualityAuth.id);
  });

  it('resolve не-FLAGGED отзыва -> 409 INVALID_STATE_TRANSITION', async () => {
    const exp = await acceptingExpert(PH_E7);
    const cli = await clientUser(PH_C7);
    const reviewId = await matchAndReview(cli, exp, 5);

    const res = await request(app.getHttpServer())
      .post(`/v1/admin/reviews/${reviewId}/resolve`)
      .set(...qualityAuth.authHeader)
      .send({ action: 'hide' })
      .expect(409);
    expect(res.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('админ-эндпоинты без токена -> 401', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/reviews/flagged')
      .expect(401);
    await request(app.getHttpServer())
      .post(`/v1/admin/reviews/${DUMMY_ID}/resolve`)
      .send({ action: 'hide' })
      .expect(401);
  });

  it('токен клиента (не сотрудника админки) -> 403 ADMIN_FORBIDDEN на обоих маршрутах', async () => {
    const deviceId = `${GUEST_DEVICE_PREFIX}${Date.now()}`;
    const client = await guestClient(app, deviceId);
    const clientAuth: [string, string] = [
      'Authorization',
      `Bearer ${client.accessToken}`,
    ];

    const cases: Array<[string, string]> = [
      ['get', '/v1/admin/reviews/flagged'],
      ['post', `/v1/admin/reviews/${DUMMY_ID}/resolve`],
    ];
    for (const [method, url] of cases) {
      const res = await (request(app.getHttpServer()) as any)
        [method](url)
        .set(...clientAuth)
        .send({ action: 'hide' })
        .expect(403);
      expect(res.body.error.code).toBe('ADMIN_FORBIDDEN');
    }
  });

  it('роль FINANCE_CONTROL (без QUALITY_TEAM) -> 403 ADMIN_FORBIDDEN на обоих маршрутах', async () => {
    const finance = await adminUser(
      app,
      [AdminRole.FINANCE_CONTROL],
      uniqueAdminEmail('finance'),
    );

    const cases: Array<[string, string]> = [
      ['get', '/v1/admin/reviews/flagged'],
      ['post', `/v1/admin/reviews/${DUMMY_ID}/resolve`],
    ];
    for (const [method, url] of cases) {
      const res = await (request(app.getHttpServer()) as any)
        [method](url)
        .set(...finance.authHeader)
        .send({ action: 'hide' })
        .expect(403);
      expect(res.body.error.code).toBe('ADMIN_FORBIDDEN');
    }
  });

  it('роль SUPERADMIN проходит на resolve без роли QUALITY_TEAM, actorId в audit — id суперадмина', async () => {
    const superadmin = await adminUser(
      app,
      [AdminRole.SUPERADMIN],
      uniqueAdminEmail('superadmin'),
    );
    const exp = await acceptingExpert(PH_E8);
    const cli = await clientUser(PH_C8);
    const reviewId = await matchAndReview(cli, exp, 2);

    await post(exp.accessToken, `/v1/reviews/${reviewId}/complaint`)
      .send({ text: 'Жалоба на отзыв' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/v1/admin/reviews/flagged')
      .set(...superadmin.authHeader)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/v1/admin/reviews/${reviewId}/resolve`)
      .set(...superadmin.authHeader)
      .send({ action: 'restore' })
      .expect(200);

    const audit = await prisma.auditLog.findFirst({
      where: {
        entity: 'review',
        entityId: reviewId,
        transition: 'review.restored',
      },
    });
    expect(audit?.actorId).toBe(superadmin.id);
  });
});
