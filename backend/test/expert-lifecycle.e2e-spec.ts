import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';

const ADMIN = { 'X-Admin-Token': 'dev-admin-token-0123456789abcdef' };

// Номера спека задачи 9 (E2, сквозной lifecycle), не пересекаются с другими спеками.
const PHONE_L1 = '+77079000001';
const PHONE_L2 = '+77079000002';
const ALL_PHONES = [PHONE_L1, PHONE_L2];

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

const WEEKDAYS_5x2 = [
  ...[0, 1, 2, 3, 4].map((weekday) => ({
    weekday,
    enabled: true,
    startMin: 540,
    endMin: 1080,
    breakStart: 780,
    breakEnd: 810,
  })),
  ...[5, 6].map((weekday) => ({
    weekday,
    enabled: false,
    startMin: 540,
    endMin: 1080,
  })),
];

describe('Expert lifecycle e2e (сквозной сценарий, задача 9)', () => {
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

  async function createProfile(accessToken: string) {
    const res = await request(app.getHttpServer())
      .post('/v1/experts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(validDto)
      .expect(201);
    registeredExpertIds.push(res.body.id as string);
    return res.body as { id: string; verificationStatus: string };
  }

  async function uploadDoc(accessToken: string, type: string) {
    return request(app.getHttpServer())
      .post(`/v1/experts/me/documents/${type}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('%PDF-1.4 fake'), 'doc.pdf')
      .expect(201);
  }

  async function submitDocs(accessToken: string) {
    return request(app.getHttpServer())
      .post('/v1/experts/me/documents/submit')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  }

  async function adminApproveAllDocs(expertId: string) {
    const docs = await prisma.expertDocument.findMany({ where: { expertId } });
    for (const doc of docs) {
      await request(app.getHttpServer())
        .post(`/v1/admin/verification/documents/${doc.id}/decision`)
        .set(ADMIN)
        .send({ approve: true })
        .expect(200);
    }
    return docs;
  }

  async function adminApproveExpert(expertId: string) {
    return request(app.getHttpServer())
      .post(`/v1/admin/verification/${expertId}/decision`)
      .set(ADMIN)
      .send({ approve: true })
      .expect(200);
  }

  async function setWorkStatus(accessToken: string, workStatus: string) {
    return request(app.getHttpServer())
      .patch('/v1/experts/me/work-status')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ workStatus })
      .expect(200);
  }

  async function putSchedule(accessToken: string, days: unknown) {
    return request(app.getHttpServer())
      .put('/v1/experts/me/schedule')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ days })
      .expect(200);
  }

  it('полный цикл: регистрация → анкета → 4 документа → submit → админ approve → ACCEPTING → расписание → публичная карточка', async () => {
    const { accessToken } = await registeredUser(PHONE_L1);
    const expert = await createProfile(accessToken); // DRAFT
    expect(expert.verificationStatus).toBe('DRAFT');

    for (const t of DOC_TYPES) await uploadDoc(accessToken, t);
    const submitted = await submitDocs(accessToken); // PENDING
    expect(submitted.body.verificationStatus).toBe('PENDING');

    await adminApproveAllDocs(expert.id);
    const approved = await adminApproveExpert(expert.id); // VERIFIED
    expect(approved.body.verificationStatus).toBe('VERIFIED');

    await setWorkStatus(accessToken, 'ACCEPTING'); // presence+
    expect(await redis.sismember('experts:available', expert.id)).toBe(1);

    await putSchedule(accessToken, WEEKDAYS_5x2);

    const pub = await request(app.getHttpServer())
      .get(`/v1/experts/${expert.id}`)
      .expect(200);
    expect(pub.body.workStatus).toBe('ACCEPTING');
    expect(pub.body.userId).toBeUndefined();
    expect(pub.body.phone).toBeUndefined();
    expect(JSON.stringify(pub.body)).not.toMatch(/\+77\d{9}/);

    const audit = await prisma.auditLog.findMany({
      where: { entity: 'expert', entityId: expert.id },
    });
    expect(audit.map((a) => a.transition)).toEqual(
      expect.arrayContaining([
        'expert.profile_created',
        'expert.verification_submitted',
        'expert.verified',
        'expert.work_status_changed',
        'expert.schedule_updated',
      ]),
    );
  });

  it('негативная ветка: reject документа из PENDING → REUPLOAD_REQUIRED → повторная загрузка → submit снова доступен → PENDING', async () => {
    const { accessToken } = await registeredUser(PHONE_L2);
    const expert = await createProfile(accessToken); // DRAFT

    for (const t of DOC_TYPES) await uploadDoc(accessToken, t);
    await submitDocs(accessToken); // PENDING

    const docs = await prisma.expertDocument.findMany({
      where: { expertId: expert.id },
    });
    const identityDoc = docs.find((d) => d.type === 'IDENTITY')!;

    const rejected = await request(app.getHttpServer())
      .post(`/v1/admin/verification/documents/${identityDoc.id}/decision`)
      .set(ADMIN)
      .send({ approve: false, comment: 'Скан нечитаем' })
      .expect(200);
    expect(rejected.body).toBeDefined();

    const afterReject = await prisma.expert.findUnique({
      where: { id: expert.id },
    });
    expect(afterReject!.verificationStatus).toBe('DRAFT');

    const rejectedDoc = await prisma.expertDocument.findUnique({
      where: { id: identityDoc.id },
    });
    expect(rejectedDoc!.status).toBe('REUPLOAD_REQUIRED');
    expect(rejectedDoc!.comment).toBe('Скан нечитаем');

    // Повторная загрузка отклонённого документа -> снова UPLOADED.
    const reuploaded = await uploadDoc(accessToken, 'IDENTITY');
    expect(reuploaded.body).toMatchObject({
      type: 'IDENTITY',
      status: 'UPLOADED',
    });

    const resubmitted = await submitDocs(accessToken); // снова PENDING
    expect(resubmitted.body.verificationStatus).toBe('PENDING');
  });
});
