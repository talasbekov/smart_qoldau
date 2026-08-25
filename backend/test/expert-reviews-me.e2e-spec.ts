import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import {
  registeredExpertUser,
  putScheduleAlwaysOn,
} from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Долг из Plane (заведён при закрытии E7): GET /experts/{id}/reviews
// анонимный и не отдаёт id отзыва, поэтому app_expert не может вызвать
// POST /reviews/{id}/reply|complaint по нему. Этот спек проверяет новый
// GET /experts/me/reviews — тот же контент, но с id, только для владельца.
// Номера не пересекаются с другими спеками (проверено grep по всем
// +77[0-9]{3} в test/): +77108xxxxx свободен.
const PH_E1 = '+77108000001';
const PH_E2 = '+77108000002';
const PH_ESTRANGER = '+77108000003';
const PH_C1 = '+77108000091';
const PH_C2 = '+77108000092';
const ALL_PHONES = [PH_E1, PH_E2, PH_ESTRANGER, PH_C1, PH_C2];

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

let app: INestApplication;

describe('GET /experts/me/reviews — свои отзывы с id (долг E7)', () => {
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
      Test.createTestingModule({ imports: [AppModule] }).overrideProvider(
        SMS_PROVIDER_TOKEN,
      ).useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
  });

  beforeEach(cleanup);

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
    rating = 5,
  ) {
    await post(cli.accessToken, '/v1/requests')
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
    await post(exp.accessToken, `/v1/consultations/${consultationId}/complete`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);
    const review = await post(
      cli.accessToken,
      `/v1/consultations/${consultationId}/review`,
    )
      .send({ rating, publicText: 'Отличная консультация' })
      .expect(201);
    return review.body.id as string;
  }

  it('возвращает id отзыва, которого нет в публичной /experts/{id}/reviews', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const reviewId = await matchAndReview(cli, exp);

    const mine = await get(exp.accessToken, '/v1/experts/me/reviews').expect(
      200,
    );
    expect(mine.body.items).toHaveLength(1);
    expect(mine.body.items[0].id).toBe(reviewId);
    expect(mine.body.items[0].rating).toBe(5);
    expect(mine.body.items[0].publicText).toBe('Отличная консультация');
    expect(mine.body.distribution[5]).toBe(1);
    expect(mine.body.ratingCount).toBe(1);

    const publicList = await request(app.getHttpServer())
      .get(`/v1/experts/${exp.expertId}/reviews`)
      .expect(200);
    expect(publicList.body.items[0].id).toBeUndefined();
  });

  it('id из /experts/me/reviews действительно принимается reply/complaint', async () => {
    const exp = await acceptingExpert(PH_E2);
    const cli = await clientUser(PH_C2);
    const reviewId = await matchAndReview(cli, exp, 4);

    const mine = await get(exp.accessToken, '/v1/experts/me/reviews').expect(
      200,
    );
    const idFromMe = mine.body.items[0].id as string;
    expect(idFromMe).toBe(reviewId);

    await post(exp.accessToken, `/v1/reviews/${idFromMe}/reply`)
      .send({ text: 'Спасибо!' })
      .expect(200);

    const after = await get(exp.accessToken, '/v1/experts/me/reviews').expect(
      200,
    );
    expect(after.body.items[0].expertReply).toBe('Спасибо!');
  });

  it('без токена -> 401', async () => {
    await request(app.getHttpServer())
      .get('/v1/experts/me/reviews')
      .expect(401);
  });

  it('токен клиента (не эксперта) -> 404 EXPERT_NOT_FOUND', async () => {
    const cli = await clientUser(PH_C1);
    const res = await get(cli.accessToken, '/v1/experts/me/reviews').expect(
      404,
    );
    expect(res.body.error.code).toBe('EXPERT_NOT_FOUND');
  });

  it('не видит чужие отзывы', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    await matchAndReview(cli, exp);

    const stranger = await acceptingExpert(PH_ESTRANGER);
    const res = await get(
      stranger.accessToken,
      '/v1/experts/me/reviews',
    ).expect(200);
    expect(res.body.items).toHaveLength(0);
  });
});
