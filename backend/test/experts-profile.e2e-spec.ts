import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';

// Номера спека задачи 3 (E2), не пересекаются с другими спеками.
const PHONE_E1 = '+77071000001';
const PHONE_E2 = '+77071000002';
const PHONE_E3 = '+77071000003';
const ALL_PHONES = [PHONE_E1, PHONE_E2, PHONE_E3];

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

describe('Experts profile (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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

  async function registeredExpertUser(phone: string) {
    const auth = await registeredUser(phone);
    await request(app.getHttpServer())
      .post('/v1/experts')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send(validDto)
      .expect(201);
    return auth;
  }

  it('создание профиля: валидная анкета -> 201, повтор -> 409 EXPERT_EXISTS', async () => {
    const { accessToken } = await registeredUser(PHONE_E1);
    const res = await request(app.getHttpServer())
      .post('/v1/experts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(validDto)
      .expect(201);
    expect(res.body).toMatchObject({
      verificationStatus: 'DRAFT',
      workStatus: 'NOT_ACCEPTING',
      topicSlugs: ['anxiety-stress', 'burnout'],
    });
    expect(res.body.userId).toBeUndefined();
    expect(res.body.phone).toBeUndefined();

    const dup = await request(app.getHttpServer())
      .post('/v1/experts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(validDto)
      .expect(409);
    expect(dup.body.error.code).toBe('EXPERT_EXISTS');
  });

  it('цена вне коридора 200000-1500000 тиын -> 400 PRICE_OUT_OF_RANGE', async () => {
    const { accessToken } = await registeredUser(PHONE_E2);
    const res = await request(app.getHttpServer())
      .post('/v1/experts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...validDto, priceTiyn: 150000 })
      .expect(400);
    expect(res.body.error.code).toBe('PRICE_OUT_OF_RANGE');
  });

  it('гость не может создать профиль -> 403', async () => {
    const g = await request(app.getHttpServer())
      .post('/v1/auth/guest')
      .send({ deviceId: 'exp-dev-1' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/v1/experts')
      .set('Authorization', `Bearer ${g.body.accessToken}`)
      .send(validDto)
      .expect(403);
  });

  it('пустая анкета -> 400 VALIDATION_FAILED', async () => {
    const { accessToken } = await registeredUser(PHONE_E1);
    const res = await request(app.getHttpServer())
      .post('/v1/experts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('неизвестный topicSlug -> 400 VALIDATION_FAILED', async () => {
    const { accessToken } = await registeredUser(PHONE_E1);
    const res = await request(app.getHttpServer())
      .post('/v1/experts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...validDto, topicSlugs: ['does-not-exist'] })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('GET /v1/experts/me без профиля -> 404 EXPERT_NOT_FOUND', async () => {
    const { accessToken } = await registeredUser(PHONE_E1);
    const res = await request(app.getHttpServer())
      .get('/v1/experts/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
    expect(res.body.error.code).toBe('EXPERT_NOT_FOUND');
  });

  it('GET /v1/experts/me возвращает анкету без PII', async () => {
    const { accessToken } = await registeredExpertUser(PHONE_E1);
    const res = await request(app.getHttpServer())
      .get('/v1/experts/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body).toMatchObject({
      displayName: validDto.displayName,
      city: validDto.city,
      priceTiyn: validDto.priceTiyn,
      topicSlugs: ['anxiety-stress', 'burnout'],
    });
    expect(res.body.userId).toBeUndefined();
    expect(res.body.phone).toBeUndefined();
  });

  it('PATCH /v1/experts/me меняет цену и специализации (Р-18)', async () => {
    const { accessToken } = await registeredExpertUser(PHONE_E3);
    const res = await request(app.getHttpServer())
      .patch('/v1/experts/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ priceTiyn: 449000, topicSlugs: ['self-esteem'] })
      .expect(200);
    expect(res.body.priceTiyn).toBe(449000);
    expect(res.body.topicSlugs).toEqual(['self-esteem']);
  });

  it('PATCH /v1/experts/me без профиля -> 404 EXPERT_NOT_FOUND', async () => {
    const { accessToken } = await registeredUser(PHONE_E1);
    const res = await request(app.getHttpServer())
      .patch('/v1/experts/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ priceTiyn: 449000 })
      .expect(404);
    expect(res.body.error.code).toBe('EXPERT_NOT_FOUND');
  });
});
