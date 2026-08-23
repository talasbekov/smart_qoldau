import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
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

// Публичный контракт профиля (E2a, задача 6). Фото и текст видны только
// после одобрения: PENDING и REJECTED наружу не показываются никогда.
const PH_E1 = '+77098500001';
const ABOUT = 'Работаю с тревогой и выгоранием, метод — КПТ и схема-терапия.';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    if (match) lastCode = match[1];
  }
}

describe('Публичный контракт профиля специалиста (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let expertId: string;
  let accessToken: string;

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: PH_E1 },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (!ids.length) return;
    const experts = await prisma.expert.findMany({
      where: { userId: { in: ids } },
      select: { id: true },
    });
    const expertIds = experts.map((e) => e.id);
    if (expertIds.length) {
      await redis.srem('experts:available', ...expertIds);
      await redis.hdel('experts:lastseen', ...expertIds);
    }
    await prisma.expertScheduleDay.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expertTopic.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expert.deleteMany({ where: { id: { in: expertIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.smsCode.deleteMany({ where: { phone: PH_E1 } });
  }

  const publicCard = () =>
    request(app.getHttpServer()).get(`/v1/experts/${expertId}`).expect(200);

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    await cleanup();

    const registered = await registeredExpertUser(app, PH_E1, () => lastCode);
    expertId = registered.expertId;
    accessToken = registered.accessToken;
    await prisma.expert.update({
      where: { id: expertId },
      data: { verificationStatus: 'VERIFIED' },
    });
    await request(app.getHttpServer())
      .patch('/v1/experts/me/work-status')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ workStatus: 'ACCEPTING' })
      .expect(200);
    await putScheduleAlwaysOn(app, accessToken);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('до загрузки фото и текста публичная карточка отдаёт null', async () => {
    const res = await publicCard();
    expect(res.body.photoUrl).toBeNull();
    expect(res.body.about).toBeNull();
  });

  it('фото и текст на проверке наружу не видны', async () => {
    const photo = await sharp({
      create: {
        width: 600,
        height: 600,
        channels: 3,
        background: { r: 10, g: 80, b: 120 },
      },
    })
      .jpeg()
      .toBuffer();
    await request(app.getHttpServer())
      .post('/v1/experts/me/photo')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', photo, 'photo.jpg')
      .expect(202);
    await request(app.getHttpServer())
      .patch('/v1/experts/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ about: ABOUT })
      .expect(200);

    const res = await publicCard();
    expect(res.body.photoUrl).toBeNull();
    expect(res.body.about).toBeNull();
  });

  it('отклонённые значения тоже не видны', async () => {
    const pending = await prisma.expert.findUniqueOrThrow({
      where: { id: expertId },
    });
    await prisma.expert.update({
      where: { id: expertId },
      data: {
        photoStatus: 'REJECTED',
        aboutStatus: 'REJECTED',
        moderationComment: 'Лицо не видно',
      },
    });

    const res = await publicCard();
    expect(res.body.photoUrl).toBeNull();
    expect(res.body.about).toBeNull();

    await prisma.expert.update({
      where: { id: expertId },
      data: {
        photoStatus: 'PENDING',
        aboutStatus: 'PENDING',
        photoPendingKey: pending.photoPendingKey,
        aboutPending: pending.aboutPending,
      },
    });
  });

  it('после одобрения фото и текст появляются в карточке и в каталоге', async () => {
    const pending = await prisma.expert.findUniqueOrThrow({
      where: { id: expertId },
    });
    await prisma.expert.update({
      where: { id: expertId },
      data: {
        photoKey: pending.photoPendingKey,
        photoPendingKey: null,
        photoStatus: 'APPROVED',
        about: pending.aboutPending,
        aboutPending: null,
        aboutStatus: 'APPROVED',
      },
    });

    const card = await publicCard();
    expect(card.body.photoUrl).toContain('.webp');
    expect(card.body.about).toBe(ABOUT);

    const list = await request(app.getHttpServer())
      .get('/v1/experts?take=100')
      .expect(200);
    const item = list.body.find((e: { id: string }) => e.id === expertId);
    expect(item.photoUrl).toBe(card.body.photoUrl);
    expect(item.about).toBe(ABOUT);
  });

  it('служебные поля модерации не появляются ни в одном публичном ответе', async () => {
    await prisma.expert.update({
      where: { id: expertId },
      data: {
        photoPendingKey: 'secret-pending-key.webp',
        photoStatus: 'PENDING',
        aboutPending: 'Черновик на проверке',
        aboutStatus: 'PENDING',
        moderationComment: 'Причина отказа',
      },
    });

    for (const url of [`/v1/experts/${expertId}`, '/v1/experts?take=100']) {
      const res = await request(app.getHttpServer()).get(url).expect(200);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('secret-pending-key');
      expect(body).not.toContain('Черновик на проверке');
      expect(body).not.toContain('Причина отказа');
      expect(body.toLowerCase()).not.toContain('pending');
      expect(body.toLowerCase()).not.toContain('moderation');
    }
  });
});
