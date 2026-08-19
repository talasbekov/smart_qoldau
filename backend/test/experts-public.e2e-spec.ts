import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';

const ADMIN = { 'X-Admin-Token': 'dev-admin-token-0123456789abcdef' };

// Номера спека задачи 8 (E2), не пересекаются с другими спеками.
const PHONE_P1 = '+77074000001';
const PHONE_P2 = '+77074000002';
const PHONE_P3 = '+77074000003';
const PHONE_P4 = '+77074000004';
const PHONE_P5 = '+77074000005';
const ALL_PHONES = [PHONE_P1, PHONE_P2, PHONE_P3, PHONE_P4, PHONE_P5];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

const DOC_TYPES = ['IDENTITY', 'DIPLOMA', 'CERTIFICATES', 'QUALIFICATION'];

function makeDto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    displayName: 'Айгуль С.',
    city: 'Алматы',
    experience: 'FIVE_TO_TEN',
    education: 'КазНУ им. аль-Фараби',
    priceTiyn: 399000,
    languages: ['ru', 'kz'],
    formats: ['chat', 'audio', 'video'],
    topicSlugs: ['anxiety-stress', 'burnout'],
    ...overrides,
  };
}

describe('Experts public (e2e)', () => {
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

  // register -> profile (DRAFT). Профиль не отправлен на верификацию.
  async function registeredExpertUser(
    phone: string,
    dtoOverrides: Partial<Record<string, unknown>> = {},
  ) {
    const auth = await registeredUser(phone);
    const profile = await request(app.getHttpServer())
      .post('/v1/experts')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send(makeDto(dtoOverrides))
      .expect(201);
    return {
      accessToken: auth.accessToken,
      expertId: profile.body.id as string,
    };
  }

  async function submittedExpert(
    phone: string,
    dtoOverrides: Partial<Record<string, unknown>> = {},
  ) {
    const { accessToken, expertId } = await registeredExpertUser(
      phone,
      dtoOverrides,
    );

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

    return { accessToken, expertId, docIds };
  }

  async function verifiedExpert(
    phone: string,
    dtoOverrides: Partial<Record<string, unknown>> = {},
  ) {
    const result = await submittedExpert(phone, dtoOverrides);
    for (const id of result.docIds) {
      await request(app.getHttpServer())
        .post(`/v1/admin/verification/documents/${id}/decision`)
        .set(ADMIN)
        .send({ approve: true })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post(`/v1/admin/verification/${result.expertId}/decision`)
      .set(ADMIN)
      .send({ approve: true })
      .expect(200);
    return result;
  }

  async function blockExpert(expertId: string) {
    await request(app.getHttpServer())
      .post(`/v1/admin/experts/${expertId}/block`)
      .set(ADMIN)
      .send({ reason: 'Жалобы' })
      .expect(200);
  }

  it('в списке только verified и не blocked; PII отсутствует', async () => {
    const v = await verifiedExpert(PHONE_P1);
    await registeredExpertUser(PHONE_P2);
    const b = await verifiedExpert(PHONE_P3);
    await blockExpert(b.expertId);

    const res = await request(app.getHttpServer())
      .get('/v1/experts')
      .expect(200);
    const ids = res.body.map((e: any) => e.id);
    expect(ids).toContain(v.expertId);
    expect(ids).not.toContain(b.expertId);
    for (const e of res.body) {
      expect(e.userId).toBeUndefined();
      expect(e.phone).toBeUndefined();
      expect(e.documents).toBeUndefined();
      expect(e.education).toBeUndefined();
      expect(e.verificationStatus).toBeUndefined();
      expect(e.isBlocked).toBeUndefined();
      expect(JSON.stringify(e)).not.toMatch(/\+77\d{9}/);
    }
  });

  it('фильтры topic/language/format сужают список; sort=price_asc сортирует', async () => {
    const cheap = await verifiedExpert(PHONE_P4, {
      priceTiyn: 250000,
      languages: ['kz'],
      formats: ['chat'],
      topicSlugs: ['sleep'],
    });
    const expensive = await verifiedExpert(PHONE_P5, {
      priceTiyn: 900000,
      languages: ['en'],
      formats: ['video'],
      topicSlugs: ['loneliness'],
    });

    const byTopic = await request(app.getHttpServer())
      .get('/v1/experts')
      .query({ topic: 'sleep' })
      .expect(200);
    const topicIds = byTopic.body.map((e: any) => e.id);
    expect(topicIds).toContain(cheap.expertId);
    expect(topicIds).not.toContain(expensive.expertId);

    const byLanguage = await request(app.getHttpServer())
      .get('/v1/experts')
      .query({ language: 'en' })
      .expect(200);
    const langIds = byLanguage.body.map((e: any) => e.id);
    expect(langIds).toContain(expensive.expertId);
    expect(langIds).not.toContain(cheap.expertId);

    const byFormat = await request(app.getHttpServer())
      .get('/v1/experts')
      .query({ format: 'chat' })
      .expect(200);
    const formatIds = byFormat.body.map((e: any) => e.id);
    expect(formatIds).toContain(cheap.expertId);
    expect(formatIds).not.toContain(expensive.expertId);

    const sorted = await request(app.getHttpServer())
      .get('/v1/experts')
      .query({ sort: 'price_asc' })
      .expect(200);
    const prices = sorted.body
      .filter((e: any) => [cheap.expertId, expensive.expertId].includes(e.id))
      .map((e: any) => e.priceTiyn);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));

    const sortedDesc = await request(app.getHttpServer())
      .get('/v1/experts')
      .query({ sort: 'price_desc' })
      .expect(200);
    const pricesDesc = sortedDesc.body
      .filter((e: any) => [cheap.expertId, expensive.expertId].includes(e.id))
      .map((e: any) => e.priceTiyn);
    expect(pricesDesc).toEqual([...pricesDesc].sort((a, b) => b - a));
  });

  it('GET /v1/experts/:id для DRAFT и blocked -> 404 EXPERT_NOT_FOUND', async () => {
    const draft = await registeredExpertUser(PHONE_P2);
    const resDraft = await request(app.getHttpServer())
      .get(`/v1/experts/${draft.expertId}`)
      .expect(404);
    expect(resDraft.body.error.code).toBe('EXPERT_NOT_FOUND');

    const blocked = await verifiedExpert(PHONE_P3);
    await blockExpert(blocked.expertId);
    const resBlocked = await request(app.getHttpServer())
      .get(`/v1/experts/${blocked.expertId}`)
      .expect(404);
    expect(resBlocked.body.error.code).toBe('EXPERT_NOT_FOUND');

    const resMissing = await request(app.getHttpServer())
      .get('/v1/experts/00000000-0000-0000-0000-000000000000')
      .expect(404);
    expect(resMissing.body.error.code).toBe('EXPERT_NOT_FOUND');
  });

  it('GET /v1/experts/:id для VERIFIED возвращает публичную карточку без PII', async () => {
    const v = await verifiedExpert(PHONE_P1);
    const res = await request(app.getHttpServer())
      .get(`/v1/experts/${v.expertId}`)
      .expect(200);
    expect(res.body.id).toBe(v.expertId);
    expect(res.body.userId).toBeUndefined();
    expect(res.body.phone).toBeUndefined();
    expect(res.body.documents).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/\+77\d{9}/);
  });

  it('GET /v1/experts/me с токеном по-прежнему работает (маршрут не перехвачен публичным :id)', async () => {
    const v = await verifiedExpert(PHONE_P1);
    const res = await request(app.getHttpServer())
      .get('/v1/experts/me')
      .set('Authorization', `Bearer ${v.accessToken}`)
      .expect(200);
    expect(res.body.id).toBe(v.expertId);
  });
});
