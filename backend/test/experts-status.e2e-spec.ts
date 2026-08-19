import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';

const ADMIN = { 'X-Admin-Token': 'dev-admin-token-0123456789abcdef' };

// Номера спека задачи 6 (E2), не пересекаются с другими спеками.
const PHONE_S1 = '+77074000001';
const PHONE_S2 = '+77074000002';
const PHONE_S3 = '+77074000003';
const ALL_PHONES = [PHONE_S1, PHONE_S2, PHONE_S3];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

const validDto = {
  displayName: 'Айгуль С.',
  city: 'Алматы',
  experience: 'FIVE_TO_TEN',
  education: 'КазНУ им. аль-Фараби',
  priceTiyn: 399000,
  languages: ['ru', 'kz'],
  formats: ['chat', 'audio', 'video'],
  topicSlugs: ['anxiety-stress', 'burnout'],
};

const DOC_TYPES = ['IDENTITY', 'DIPLOMA', 'CERTIFICATES', 'QUALIFICATION'];

describe('Experts work-status + presence (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  const registeredExpertIds: string[] = [];

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
    if (registeredExpertIds.length)
      await redis.srem('experts:available', ...registeredExpertIds);
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
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
  });

  beforeEach(() => cleanup());

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function registeredUser(phone: string) {
    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone })
      .expect(204);
    const res = await request(app.getHttpServer())
      .post('/v1/auth/verify-code')
      .send({ phone, code: lastCode })
      .expect(200);
    return res.body as {
      accessToken: string;
      refreshToken: string;
      user: { id: string; phone: string; isGuest: boolean };
    };
  }

  // register -> profile (DRAFT). Возвращает accessToken и expertId.
  async function registeredExpertUser(phone: string) {
    const auth = await registeredUser(phone);
    const profile = await request(app.getHttpServer())
      .post('/v1/experts')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send(validDto)
      .expect(201);
    const expertId = profile.body.id as string;
    registeredExpertIds.push(expertId);
    return { accessToken: auth.accessToken, expertId };
  }

  // register -> profile -> 4 документа -> submit -> админ approve всех
  // документов и анкеты -> VERIFIED.
  async function verifiedExpert(phone: string) {
    const { accessToken, expertId } = await registeredExpertUser(phone);

    const docIds: string[] = [];
    for (const type of DOC_TYPES) {
      await request(app.getHttpServer())
        .post(`/v1/experts/me/documents/${type}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from('%PDF-1.4 fake'), 'doc.pdf')
        .expect(201);
    }
    const docs = await prisma.expertDocument.findMany({
      where: { expertId },
    });
    const byType = new Map(docs.map((d) => [d.type as string, d.id]));
    for (const type of DOC_TYPES) docIds.push(byType.get(type)!);

    await request(app.getHttpServer())
      .post('/v1/experts/me/documents/submit')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    for (const id of docIds) {
      await request(app.getHttpServer())
        .post(`/v1/admin/verification/documents/${id}/decision`)
        .set(ADMIN)
        .send({ approve: true })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post(`/v1/admin/verification/${expertId}/decision`)
      .set(ADMIN)
      .send({ approve: true })
      .expect(200);

    return { accessToken, expertId };
  }

  // verifiedExpert + ACCEPTING.
  async function acceptingExpert(phone: string) {
    const result = await verifiedExpert(phone);
    await request(app.getHttpServer())
      .patch('/v1/experts/me/work-status')
      .set('Authorization', `Bearer ${result.accessToken}`)
      .send({ workStatus: 'ACCEPTING' })
      .expect(200);
    return result;
  }

  it('невериф. эксперт не может ACCEPTING -> 400 NOT_VERIFIED', async () => {
    const { accessToken } = await registeredExpertUser(PHONE_S1); // DRAFT
    const res = await request(app.getHttpServer())
      .patch('/v1/experts/me/work-status')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ workStatus: 'ACCEPTING' })
      .expect(400);
    expect(res.body.error.code).toBe('NOT_VERIFIED');
  });

  it('verified: ACCEPTING попадает в presence, NOT_ACCEPTING убирает', async () => {
    const { accessToken, expertId } = await verifiedExpert(PHONE_S2);
    await request(app.getHttpServer())
      .patch('/v1/experts/me/work-status')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ workStatus: 'ACCEPTING' })
      .expect(200);
    expect(await redis.sismember('experts:available', expertId)).toBe(1);
    await request(app.getHttpServer())
      .patch('/v1/experts/me/work-status')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ workStatus: 'NOT_ACCEPTING' })
      .expect(200);
    expect(await redis.sismember('experts:available', expertId)).toBe(0);
  });

  it('блокировка админом снимает эксперта из presence', async () => {
    const { expertId } = await acceptingExpert(PHONE_S3);
    await request(app.getHttpServer())
      .post(`/v1/admin/experts/${expertId}/block`)
      .set(ADMIN)
      .send({ reason: 'test' })
      .expect(200);
    expect(await redis.sismember('experts:available', expertId)).toBe(0);
  });
});
