import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole } from '@prisma/client';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { StorageService } from '../src/storage/storage.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { adminUser } from './utils/admin-helpers';
import {
  putScheduleAlwaysOn,
  registeredExpertUser,
} from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Сквозной прогон эпика E2a (задача 8): путь фотографии и текста «о себе»
// от загрузки до публикации, теги отзыва и удаление отзыва по reviewId из
// контракта, а не по локальной памяти приложения.
const PH_E1 = '+77098700001';
const PH_C1 = '+77098700091';
const ALL_PHONES = [PH_E1, PH_C1];
const EMAIL_PREFIX = 'profile-lifecycle-e2e-';
const ABOUT = 'Работаю с тревогой и выгоранием, метод — КПТ и схема-терапия.';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    if (match) lastCode = match[1];
  }
}

const photo = (background: { r: number; g: number; b: number }) =>
  sharp({ create: { width: 640, height: 640, channels: 3, background } })
    .jpeg()
    .toBuffer();

describe('Публичный профиль специалиста: сквозной путь (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let storage: StorageService;

  async function cleanup() {
    await prisma.adminUser.deleteMany({
      where: { email: { startsWith: EMAIL_PREFIX } },
    });
    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    if (!userIds.length) return;
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

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    storage = app.get(StorageService);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('фото и текст проходят модерацию, отзыв с тегами публикуется и удаляется по reviewId', async () => {
    const operator = await adminUser(
      app,
      [AdminRole.VERIFICATION_OPERATOR],
      `${EMAIL_PREFIX}operator@smartqoldau.kz`,
    );

    // --- 1. Специалист загружает фото и текст ---
    const expert = await registeredExpertUser(app, PH_E1, () => lastCode);
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

    await request(app.getHttpServer())
      .post('/v1/experts/me/photo')
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .attach('file', await photo({ r: 200, g: 30, b: 30 }), 'photo.jpg')
      .expect(202);
    await request(app.getHttpServer())
      .patch('/v1/experts/me')
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({ about: ABOUT })
      .expect(200);

    // --- 2. Клиент их пока не видит ---
    const hidden = await request(app.getHttpServer())
      .get(`/v1/experts/${expert.expertId}`)
      .expect(200);
    expect(hidden.body.photoUrl).toBeNull();
    expect(hidden.body.about).toBeNull();

    // --- 3. Оператор отклоняет фото с причиной, специалист её видит ---
    const rejectedKey = (
      await prisma.expert.findUniqueOrThrow({ where: { id: expert.expertId } })
    ).photoPendingKey!;
    await request(app.getHttpServer())
      .post(`/v1/admin/profile-moderation/${expert.expertId}/photo/decision`)
      .set(...operator.authHeader)
      .send({ action: 'reject', comment: 'Лицо не видно' })
      .expect(200);

    const me = await request(app.getHttpServer())
      .get('/v1/experts/me')
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .expect(200);
    expect(me.body.photoStatus).toBe('REJECTED');
    expect(me.body.moderationComment).toBe('Лицо не видно');
    expect((await fetch(storage.avatarUrl(rejectedKey))).status).toBe(404);

    // --- 4. Специалист загружает другое фото, оператор одобряет оба поля ---
    await request(app.getHttpServer())
      .post('/v1/experts/me/photo')
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .attach('file', await photo({ r: 30, g: 120, b: 200 }), 'photo.jpg')
      .expect(202);

    const queue = await request(app.getHttpServer())
      .get('/v1/admin/profile-moderation')
      .set(...operator.authHeader)
      .expect(200);
    expect(
      queue.body.items.some(
        (i: { expertId: string }) => i.expertId === expert.expertId,
      ),
    ).toBe(true);

    for (const field of ['photo', 'about']) {
      await request(app.getHttpServer())
        .post(
          `/v1/admin/profile-moderation/${expert.expertId}/${field}/decision`,
        )
        .set(...operator.authHeader)
        .send({ action: 'approve' })
        .expect(200);
    }

    // --- 5. Клиент видит фото и текст в карточке и в каталоге ---
    const card = await request(app.getHttpServer())
      .get(`/v1/experts/${expert.expertId}`)
      .expect(200);
    expect(card.body.about).toBe(ABOUT);
    expect(card.body.photoUrl).toContain('.webp');
    expect((await fetch(card.body.photoUrl)).status).toBe(200);

    const catalog = await request(app.getHttpServer())
      .get('/v1/experts?take=100')
      .expect(200);
    const listed = catalog.body.find(
      (e: { id: string }) => e.id === expert.expertId,
    );
    expect(listed.photoUrl).toBe(card.body.photoUrl);

    // --- 6. Консультация, отзыв с тегами ---
    const client = await clientUserHelper(app, PH_C1, () => lastCode);
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
    await request(app.getHttpServer())
      .post(`/v1/consultations/${consultationId}/complete`)
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/v1/consultations/${consultationId}/review`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({
        rating: 5,
        publicText: 'Помогла разобраться за одну встречу',
        tags: ['attentive', 'exceeded_expectations'],
      })
      .expect(201);

    const reviews = await request(app.getHttpServer())
      .get(`/v1/experts/${expert.expertId}/reviews`)
      .expect(200);
    expect(reviews.body.items[0].tags).toEqual([
      'attentive',
      'exceeded_expectations',
    ]);

    // --- 7. Отзыв удаляется по reviewId из контракта, рейтинг пересчитан ---
    const details = await request(app.getHttpServer())
      .get(`/v1/consultations/${consultationId}`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);
    expect(details.body.reviewId).toBeTruthy();

    await request(app.getHttpServer())
      .delete(`/v1/reviews/${details.body.reviewId}`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(204);

    const afterDelete = await request(app.getHttpServer())
      .get(`/v1/experts/${expert.expertId}`)
      .expect(200);
    expect(afterDelete.body.ratingCount).toBe(0);
    expect(afterDelete.body.ratingAvg).toBe(0);
    // Фото и текст переживают удаление отзыва — это разные вещи.
    expect(afterDelete.body.photoUrl).toBe(card.body.photoUrl);
  });
});
