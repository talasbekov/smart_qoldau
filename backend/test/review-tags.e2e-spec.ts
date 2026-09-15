import {
  holdConsultation,
  cleanupPaidConsultations,
} from './utils/paid-consultation';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import {
  putScheduleAlwaysOn,
  registeredExpertUser,
} from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Теги отзыва (E2a, задача 6). Закрытый словарь по оценке: свободный ввод
// был бы вторым каналом публичного текста в обход модерации.
const PH_E1 = '+77098600001';
const PH_C1 = '+77098600091';
const PH_C2 = '+77098600092';
const PH_C3 = '+77098600093';
const ALL_PHONES = [PH_E1, PH_C1, PH_C2, PH_C3];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    if (match) lastCode = match[1];
  }
}

describe('Теги отзыва и reviewId (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let expert: { accessToken: string; expertId: string };

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
    if (expertIds.length) {
      await redis.srem('experts:available', ...expertIds);
      await redis.hdel('experts:lastseen', ...expertIds);
    }
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
      where: { request: { clientUserId: { in: userIds } } },
    });
    await prisma.request.deleteMany({
      where: { clientUserId: { in: userIds } },
    });
    await prisma.expertScheduleDay.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expertTopic.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expert.deleteMany({ where: { id: { in: expertIds } } });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
  }

  async function completedConsultation(phone: string): Promise<{
    accessToken: string;
    consultationId: string;
  }> {
    const client = await clientUserHelper(app, phone, () => lastCode);
    await request(app.getHttpServer())
      .post('/v1/requests')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({ topicSlug: 'anxiety-stress', format: 'chat' })
      .expect(201);
    const offers = await request(app.getHttpServer())
      .get('/v1/experts/me/offers')
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .expect(200);
    const accepted = await request(app.getHttpServer())
      .post(`/v1/offers/${offers.body[0].offerId}/accept`)
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .expect(200);
    const consultationId = accepted.body.consultationId as string;
    await holdConsultation(app, consultationId);
    await request(app.getHttpServer())
      .post(`/v1/consultations/${consultationId}/complete`)
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);
    return { accessToken: client.accessToken, consultationId };
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    await cleanup();

    expert = await registeredExpertUser(app, PH_E1, () => lastCode);
    await prisma.expert.update({
      where: { id: expert.expertId },
      data: { verificationStatus: 'VERIFIED' },
    });
    await request(app.getHttpServer())
      .patch('/v1/experts/me/work-status')
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({ workStatus: 'ACCEPTING' })
      .expect(200);
    await putScheduleAlwaysOn(app, expert.accessToken);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('теги пятёрки принимаются и видны в публичном списке отзывов', async () => {
    const { accessToken, consultationId } = await completedConsultation(PH_C1);

    const created = await request(app.getHttpServer())
      .post(`/v1/consultations/${consultationId}/review`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        rating: 5,
        tags: ['attentive', 'helped_figure_out', 'exceeded_expectations'],
      })
      .expect(201);
    expect(created.body.tags).toEqual([
      'attentive',
      'helped_figure_out',
      'exceeded_expectations',
    ]);

    const list = await request(app.getHttpServer())
      .get(`/v1/experts/${expert.expertId}/reviews`)
      .expect(200);
    expect(list.body.items[0].tags).toEqual([
      'attentive',
      'helped_figure_out',
      'exceeded_expectations',
    ]);
  });

  it('консультация отдаёт reviewId после отзыва и null до него', async () => {
    const { accessToken, consultationId } = await completedConsultation(PH_C2);

    const before = await request(app.getHttpServer())
      .get(`/v1/consultations/${consultationId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(before.body.reviewId).toBeNull();

    const created = await request(app.getHttpServer())
      .post(`/v1/consultations/${consultationId}/review`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ rating: 4, tags: ['professional'] })
      .expect(201);

    const after = await request(app.getHttpServer())
      .get(`/v1/consultations/${consultationId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(after.body.reviewId).toBe(created.body.id);
  });

  describe('отказы', () => {
    let accessToken: string;
    let consultationId: string;

    beforeAll(async () => {
      const result = await completedConsultation(PH_C3);
      accessToken = result.accessToken;
      consultationId = result.consultationId;
    });

    const review = (body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .post(`/v1/consultations/${consultationId}/review`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(body);

    it('тег из набора чужой оценки → 400 REVIEW_TAG_NOT_ALLOWED', async () => {
      const res = await review({ rating: 2, tags: ['professional'] });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('REVIEW_TAG_NOT_ALLOWED');
    });

    it('выдуманный тег → 400 REVIEW_TAG_NOT_ALLOWED', async () => {
      const res = await review({ rating: 5, tags: ['awesome'] });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('REVIEW_TAG_NOT_ALLOWED');
    });

    it('четыре тега и дубли отклоняются', async () => {
      expect(
        (
          await review({
            rating: 5,
            tags: [
              'attentive',
              'helped_figure_out',
              'exceeded_expectations',
              'attentive',
            ],
          })
        ).status,
      ).toBe(400);
      expect(
        (await review({ rating: 5, tags: ['attentive', 'attentive'] })).status,
      ).toBe(400);
    });

    it('отзыв без тегов по-прежнему принимается', async () => {
      const res = await review({ rating: 5, publicText: 'Спасибо' });
      expect(res.status).toBe(201);
      expect(res.body.tags).toEqual([]);
    });
  });
});
