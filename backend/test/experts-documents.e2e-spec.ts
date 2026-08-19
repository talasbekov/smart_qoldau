import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';

// Номера спека задачи 4 (E2), не пересекаются с другими спеками.
const PHONE_D1 = '+77072000001';
const PHONE_D2 = '+77072000002';
const PHONE_D3 = '+77072000003';
const PHONE_D4 = '+77072000004';
const ALL_PHONES = [PHONE_D1, PHONE_D2, PHONE_D3, PHONE_D4];

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

describe('Experts documents (e2e)', () => {
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

  async function registeredExpertUser(phone: string) {
    const auth = await registeredUser(phone);
    await request(app.getHttpServer())
      .post('/v1/experts')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send(validDto)
      .expect(201);
    return auth;
  }

  async function uploadDoc(accessToken: string, type: string) {
    return request(app.getHttpServer())
      .post(`/v1/experts/me/documents/${type}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('%PDF-1.4 fake'), 'doc.pdf')
      .expect(201);
  }

  it('загрузка документа -> UPLOADED; повторная замена перезаписывает', async () => {
    const { accessToken } = await registeredExpertUser(PHONE_D1);
    const res = await request(app.getHttpServer())
      .post('/v1/experts/me/documents/IDENTITY')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('%PDF-1.4 fake'), 'id.pdf')
      .expect(201);
    expect(res.body).toMatchObject({ type: 'IDENTITY', status: 'UPLOADED' });

    const res2 = await request(app.getHttpServer())
      .post('/v1/experts/me/documents/IDENTITY')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('%PDF-1.4 fake v2'), 'id2.pdf')
      .expect(201);
    expect(res2.body).toMatchObject({ type: 'IDENTITY', status: 'UPLOADED' });

    const list = await request(app.getHttpServer())
      .get('/v1/experts/me/documents')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(list.body).toHaveLength(4);
    expect(list.body.map((d: any) => d.type)).toEqual([
      'IDENTITY',
      'DIPLOMA',
      'CERTIFICATES',
      'QUALIFICATION',
    ]);
    expect(list.body[0]).toMatchObject({
      type: 'IDENTITY',
      status: 'UPLOADED',
    });
    expect(list.body[0].updatedAt).toBeDefined();
    expect(list.body[1]).toEqual({ type: 'DIPLOMA', status: null });
    expect(list.body[2]).toEqual({ type: 'CERTIFICATES', status: null });
    expect(list.body[3]).toEqual({ type: 'QUALIFICATION', status: null });
    expect(list.body[0].fileKey).toBeUndefined();
  });

  it('неизвестный :type -> 400', async () => {
    const { accessToken } = await registeredExpertUser(PHONE_D1);
    const res = await request(app.getHttpServer())
      .post('/v1/experts/me/documents/NOT_A_TYPE')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('%PDF-1.4 fake'), 'id.pdf')
      .expect(400);
    expect(res.body.error).toBeDefined();
  });

  it('submit с неполным комплектом -> 400 DOCUMENTS_INCOMPLETE', async () => {
    const { accessToken } = await registeredExpertUser(PHONE_D2);
    await uploadDoc(accessToken, 'IDENTITY');
    const res = await request(app.getHttpServer())
      .post('/v1/experts/me/documents/submit')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
    expect(res.body.error.code).toBe('DOCUMENTS_INCOMPLETE');
  });

  it('submit с 4 документами -> PENDING; повторный submit в PENDING -> 400 INVALID_STATE_TRANSITION', async () => {
    const { accessToken } = await registeredExpertUser(PHONE_D3);
    for (const t of ['IDENTITY', 'DIPLOMA', 'CERTIFICATES', 'QUALIFICATION']) {
      await uploadDoc(accessToken, t);
    }
    const res = await request(app.getHttpServer())
      .post('/v1/experts/me/documents/submit')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.verificationStatus).toBe('PENDING');

    const again = await request(app.getHttpServer())
      .post('/v1/experts/me/documents/submit')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);
    expect(again.body.error.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('файл 11 МБ -> 400 VALIDATION_FAILED', async () => {
    const { accessToken } = await registeredExpertUser(PHONE_D4);
    const bigBuffer = Buffer.alloc(11 * 1024 * 1024, 'a');
    const res = await request(app.getHttpServer())
      .post('/v1/experts/me/documents/IDENTITY')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', bigBuffer, 'big.pdf')
      .expect(400);
    expect(res.body.error).toBeDefined();
  });

  it('неверный mime (.exe) -> 400 VALIDATION_FAILED', async () => {
    const { accessToken } = await registeredExpertUser(PHONE_D4);
    const res = await request(app.getHttpServer())
      .post('/v1/experts/me/documents/IDENTITY')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('MZ fake exe'), 'virus.exe')
      .expect(400);
    expect(res.body.error).toBeDefined();
  });
});
