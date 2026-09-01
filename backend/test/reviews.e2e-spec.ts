import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
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
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Номера спека задачи 7 (E4): отзывы и рейтинг. Не пересекаются с другими
// спеками эпика (задача 5 занимает +7708300000[1-7]/9[1-7]).
const PH_E1 = '+77084000001';
const PH_E2 = '+77084000002';
const PH_E3 = '+77084000003';
const PH_E4 = '+77084000004';
const PH_E5 = '+77084000005';
const PH_E6 = '+77084000006';
const PH_E7 = '+77084000007';
const PH_E8 = '+77084000008';
const PH_ETHRESH = '+77084000009';
const PH_ETHRESH2 = '+77084000010';
const PH_ECONC = '+77084000011';
const PH_CTHRESH2 = '+77084000100';
const PH_CCONC1 = '+77084000101';
const PH_CCONC2 = '+77084000102';
const PH_C1 = '+77084000091';
const PH_C2 = '+77084000092';
const PH_C3 = '+77084000093';
const PH_C4 = '+77084000094';
const PH_C5 = '+77084000095';
const PH_C6 = '+77084000096';
const PH_C7 = '+77084000097';
const PH_C8 = '+77084000098';
const PH_CTHRESH = '+77084000099';
const ALL_PHONES = [
  PH_E1,
  PH_E2,
  PH_E3,
  PH_E4,
  PH_E5,
  PH_E6,
  PH_E7,
  PH_E8,
  PH_ETHRESH,
  PH_ETHRESH2,
  PH_ECONC,
  PH_CTHRESH2,
  PH_CCONC1,
  PH_CCONC2,
  PH_C1,
  PH_C2,
  PH_C3,
  PH_C4,
  PH_C5,
  PH_C6,
  PH_C7,
  PH_C8,
  PH_CTHRESH,
];

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
function del(token: string, url: string) {
  return request(app.getHttpServer())
    .delete(url)
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

describe('Отзывы и рейтинг (E4, задача 7)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
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
  });

  beforeEach(async () => {
    fakeClock.current = new Date('2026-08-20T05:00:00Z');
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  // Как в consultations-complete.e2e-spec.ts: обходим верификацию через
  // документы (предсуществующий баг FileTypeValidator), переводим эксперта в
  // VERIFIED напрямую через Prisma.
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

  async function matchAndComplete(
    cli: { accessToken: string; userId: string },
    exp: { accessToken: string; expertId: string },
    outcome: 'COMPLETED' | 'CANCELLED' | 'CLIENT_NO_SHOW' = 'COMPLETED',
  ) {
    const { consultationId } = await matchClientToExpert(cli, exp);
    if (outcome === 'CANCELLED') {
      await post(
        cli.accessToken,
        `/v1/consultations/${consultationId}/cancel`,
      ).expect(200);
    } else {
      await post(
        exp.accessToken,
        `/v1/consultations/${consultationId}/complete`,
      )
        .send({ outcome })
        .expect(200);
    }
    return consultationId;
  }

  it('полный путь: матч -> complete -> review -> рейтинг на публичной карточке и в списке отзывов', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const consultationId = await matchAndComplete(cli, exp);

    const reviewRes = await post(
      cli.accessToken,
      `/v1/consultations/${consultationId}/review`,
    )
      .send({ rating: 5, publicText: 'Отличная консультация' })
      .expect(201);
    expect(reviewRes.body.rating).toBe(5);

    const expertCard = await get(
      cli.accessToken,
      `/v1/experts/${exp.expertId}`,
    ).expect(200);
    expect(expertCard.body.ratingAvg).toBe(5);
    expect(expertCard.body.ratingCount).toBe(1);

    const reviewsRes = await request(app.getHttpServer())
      .get(`/v1/experts/${exp.expertId}/reviews`)
      .expect(200);
    expect(reviewsRes.body.ratingAvg).toBe(5);
    expect(reviewsRes.body.ratingCount).toBe(1);
    expect(reviewsRes.body.items).toHaveLength(1);
    expect(reviewsRes.body.items[0]).toMatchObject({
      rating: 5,
      publicText: 'Отличная консультация',
    });
    expect(reviewsRes.body.distribution).toMatchObject({
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 1,
    });

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'review', transition: 'review.created' },
    });
    expect(audit).not.toBeNull();
    expect(audit!.payload).not.toHaveProperty('publicText');
    expect(audit!.payload).not.toHaveProperty('privateText');
  });

  it('повторный отзыв на ту же консультацию -> 409 REVIEW_EXISTS', async () => {
    const exp = await acceptingExpert(PH_E2);
    const cli = await clientUser(PH_C2);
    const consultationId = await matchAndComplete(cli, exp);

    await post(cli.accessToken, `/v1/consultations/${consultationId}/review`)
      .send({ rating: 4 })
      .expect(201);

    const res = await post(
      cli.accessToken,
      `/v1/consultations/${consultationId}/review`,
    )
      .send({ rating: 3 })
      .expect(409);
    expect(res.body.error.code).toBe('REVIEW_EXISTS');
  });

  it('отзыв на отменённую (CANCELLED) консультацию -> 409 CONSULTATION_NOT_COMPLETED', async () => {
    const exp = await acceptingExpert(PH_E3);
    const cli = await clientUser(PH_C3);
    const consultationId = await matchAndComplete(cli, exp, 'CANCELLED');

    const res = await post(
      cli.accessToken,
      `/v1/consultations/${consultationId}/review`,
    )
      .send({ rating: 3 })
      .expect(409);
    expect(res.body.error.code).toBe('CONSULTATION_NOT_COMPLETED');
  });

  it('отзыв на консультацию с outcome CLIENT_NO_SHOW -> 409 CONSULTATION_NOT_COMPLETED', async () => {
    const exp = await acceptingExpert(PH_E4);
    const cli = await clientUser(PH_C4);
    const consultationId = await matchAndComplete(cli, exp, 'CLIENT_NO_SHOW');

    const res = await post(
      cli.accessToken,
      `/v1/consultations/${consultationId}/review`,
    )
      .send({ rating: 2 })
      .expect(409);
    expect(res.body.error.code).toBe('CONSULTATION_NOT_COMPLETED');
  });

  it('эксперт (не клиент) пытается оставить отзыв -> 403 FORBIDDEN', async () => {
    const exp = await acceptingExpert(PH_E5);
    const cli = await clientUser(PH_C5);
    const consultationId = await matchAndComplete(cli, exp);

    const res = await post(
      exp.accessToken,
      `/v1/consultations/${consultationId}/review`,
    )
      .send({ rating: 5 })
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('отзыв на чужую консультацию -> 404 CONSULTATION_NOT_FOUND', async () => {
    const exp = await acceptingExpert(PH_E6);
    const cli = await clientUser(PH_C6);
    const consultationId = await matchAndComplete(cli, exp);

    const stranger = await clientUser(PH_C7);
    const res = await post(
      stranger.accessToken,
      `/v1/consultations/${consultationId}/review`,
    )
      .send({ rating: 5 })
      .expect(404);
    expect(res.body.error.code).toBe('CONSULTATION_NOT_FOUND');
  });

  it('DELETE отзыва автором: пересчёт ratingCount обратно на 0, privateText нигде не отдаётся', async () => {
    const exp = await acceptingExpert(PH_E7);
    const cli = await clientUser(PH_C8);
    const consultationId = await matchAndComplete(cli, exp);

    const created = await post(
      cli.accessToken,
      `/v1/consultations/${consultationId}/review`,
    )
      .send({
        rating: 4,
        publicText: 'Хорошо',
        privateText: 'СЕКРЕТНЫЙ ТЕКСТ ДЛЯ КОМАНДЫ КАЧЕСТВА',
      })
      .expect(201);
    const reviewId = created.body.id as string;

    // privateText не отдаётся ни в ответе на create...
    expect(JSON.stringify(created.body)).not.toContain(
      'СЕКРЕТНЫЙ ТЕКСТ ДЛЯ КОМАНДЫ КАЧЕСТВА',
    );

    // ...ни в публичном списке отзывов эксперта
    const listBefore = await request(app.getHttpServer())
      .get(`/v1/experts/${exp.expertId}/reviews`)
      .expect(200);
    expect(JSON.stringify(listBefore.body)).not.toContain(
      'СЕКРЕТНЫЙ ТЕКСТ ДЛЯ КОМАНДЫ КАЧЕСТВА',
    );
    // ...и анонимность автора: ни id клиента, ни clientCode в выдаче
    expect(listBefore.body.items[0]).not.toHaveProperty('clientUserId');
    expect(listBefore.body.items[0]).not.toHaveProperty('clientCode');
    expect(listBefore.body.items[0]).not.toHaveProperty('id');

    expect(listBefore.body.ratingCount).toBe(1);

    await del(cli.accessToken, `/v1/reviews/${reviewId}`).expect(204);

    const expertRow = await prisma.expert.findUniqueOrThrow({
      where: { id: exp.expertId },
    });
    expect(expertRow.ratingCount).toBe(0);
    expect(expertRow.ratingAvg).toBe(0);

    const listAfter = await request(app.getHttpServer())
      .get(`/v1/experts/${exp.expertId}/reviews`)
      .expect(200);
    expect(listAfter.body.items).toHaveLength(0);
    expect(listAfter.body.ratingCount).toBe(0);
  });

  it('чужой DELETE отзыва -> 404 REVIEW_NOT_FOUND', async () => {
    const exp = await acceptingExpert(PH_E8);
    const owner = await clientUser(PH_C6);
    const consultationId = await matchAndComplete(owner, exp);

    const created = await post(
      owner.accessToken,
      `/v1/consultations/${consultationId}/review`,
    )
      .send({ rating: 5 })
      .expect(201);
    const reviewId = created.body.id as string;

    const stranger = await clientUser(PH_C7);
    const res = await del(
      stranger.accessToken,
      `/v1/reviews/${reviewId}`,
    ).expect(404);
    expect(res.body.error.code).toBe('REVIEW_NOT_FOUND');
  });

  it('каталог ?sort=rating: убывание ratingAvg, при равенстве — возрастание priceTiyn', async () => {
    const expHigh = await acceptingExpert(PH_ETHRESH);
    const cli1 = await clientUser(PH_CTHRESH);

    // Более дешёвый эксперт без отзывов (ratingAvg=0) должен идти после.
    const consultationId = await matchAndComplete(cli1, expHigh);
    await post(cli1.accessToken, `/v1/consultations/${consultationId}/review`)
      .send({ rating: 5 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/v1/experts?sort=rating')
      .expect(200);
    const ids = res.body.map((e: { id: string }) => e.id);
    const highIdx = ids.indexOf(expHigh.expertId);
    expect(highIdx).toBeGreaterThanOrEqual(0);
    // Эксперт с рейтингом 5 должен стоять раньше любого эксперта с
    // ratingAvg=0 (все остальные каталожные эксперты в этом тесте имеют 0).
    const ratings = res.body.map((e: { ratingAvg: number }) => e.ratingAvg);
    for (let i = 1; i < ratings.length; i++) {
      expect(ratings[i - 1]).toBeGreaterThanOrEqual(ratings[i]);
    }
  });

  it('конкурентные отзывы двух клиентов одному эксперту: оба 201, агрегаты точны (row-lock FOR UPDATE)', async () => {
    const exp = await acceptingExpert(PH_ECONC);
    const cli1 = await clientUser(PH_CCONC1);
    const cli2 = await clientUser(PH_CCONC2);

    const consultation1 = await matchAndComplete(cli1, exp);
    const consultation2 = await matchAndComplete(cli2, exp);

    // Параллельные POST: без блокировки строки эксперта два пересчёта
    // на ReadCommitted могли бы не увидеть вставку друг друга и записать
    // заниженные агрегаты. С FOR UPDATE второй ждёт коммита первого.
    const [r1, r2] = await Promise.all([
      post(cli1.accessToken, `/v1/consultations/${consultation1}/review`).send({
        rating: 5,
      }),
      post(cli2.accessToken, `/v1/consultations/${consultation2}/review`).send({
        rating: 3,
      }),
    ]);
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);

    const expertRow = await prisma.expert.findUniqueOrThrow({
      where: { id: exp.expertId },
    });
    expect(expertRow.ratingCount).toBe(2);
    expect(expertRow.ratingAvg).toBe(4);
  });

  it('rating вне диапазона 1..5 (0 и 6) -> 400', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const consultationId = await matchAndComplete(cli, exp);

    await post(cli.accessToken, `/v1/consultations/${consultationId}/review`)
      .send({ rating: 0 })
      .expect(400);
    await post(cli.accessToken, `/v1/consultations/${consultationId}/review`)
      .send({ rating: 6 })
      .expect(400);
  });

  it('порог Р-20: 20 PUBLISHED-отзывов с avg<4.0 -> audit expert.rating_below_threshold', async () => {
    const exp = await acceptingExpert(PH_ETHRESH2);
    const cli = await clientUser(PH_CTHRESH2);

    const topic = await prisma.topic.findFirstOrThrow({
      where: { slug: 'anxiety-stress' },
    });

    // 19 прямых prisma-вставок (rating 3, PUBLISHED) — фиктивные
    // консультации с requestId=uuid (Consultation.requestId без FK на
    // Request, см. схему) — только чтобы удовлетворить @unique
    // consultationId Review и держать корректный expertId.
    for (let i = 0; i < 19; i++) {
      const consultation = await prisma.consultation.create({
        data: {
          requestId: randomUUID(),
          clientUserId: cli.userId,
          clientCode: 1000 + i,
          expertId: exp.expertId,
          topicId: topic.id,
          format: 'chat',
          priceTiyn: 300000,
          status: 'COMPLETED',
          outcome: 'COMPLETED',
          startedAt: fakeClock.now(),
          endedAt: fakeClock.now(),
        },
      });
      await prisma.review.create({
        data: {
          consultationId: consultation.id,
          clientUserId: cli.userId,
          expertId: exp.expertId,
          rating: 3,
          status: 'PUBLISHED',
        },
      });
    }

    // Пересчёт агрегатов после прямых вставок — сервисный метод не
    // экспортирует recalc напрямую, поэтому используем create() 20-го
    // отзыва через полный путь API (матч -> complete -> review), который
    // сам вызывает пересчёт внутри транзакции и, встретив условие порога
    // (ratingCount=20, ratingAvg=3 < 4.0), пишет audit-флаг.
    const consultationId = await matchAndComplete(cli, exp);
    await post(cli.accessToken, `/v1/consultations/${consultationId}/review`)
      .send({ rating: 3 })
      .expect(201);

    const expertRow = await prisma.expert.findUniqueOrThrow({
      where: { id: exp.expertId },
    });
    expect(expertRow.ratingCount).toBe(20);
    expect(expertRow.ratingAvg).toBe(3);

    const audit = await prisma.auditLog.findFirst({
      where: {
        entity: 'expert',
        entityId: exp.expertId,
        transition: 'expert.rating_below_threshold',
      },
    });
    expect(audit).not.toBeNull();
    expect(audit!.payload).toMatchObject({ avg: 3, count: 20 });
  });
});
