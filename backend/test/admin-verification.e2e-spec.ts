import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';

const ADMIN = { 'X-Admin-Token': 'dev-admin-token-0123456789abcdef' };

// Номера спека задачи 5 (E2), не пересекаются с другими спеками.
const PHONE_V1 = '+77073000001';
const PHONE_V2 = '+77073000002';
const PHONE_V3 = '+77073000003';
const PHONE_V4 = '+77073000004';
const PHONE_V5 = '+77073000005';
const PHONE_V6 = '+77073000006';
const ALL_PHONES = [PHONE_V1, PHONE_V2, PHONE_V3, PHONE_V4, PHONE_V5, PHONE_V6];

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

describe('Admin verification (e2e)', () => {
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

  // register -> profile -> 4 документа -> submit. Возвращает accessToken,
  // expertId и docIds по порядку DOC_TYPES.
  async function submittedExpert(phone: string) {
    const auth = await registeredUser(phone);
    const profile = await request(app.getHttpServer())
      .post('/v1/experts')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send(validDto)
      .expect(201);
    const expertId = profile.body.id as string;

    const docIds: string[] = [];
    for (const type of DOC_TYPES) {
      await request(app.getHttpServer())
        .post(`/v1/experts/me/documents/${type}`)
        .set('Authorization', `Bearer ${auth.accessToken}`)
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
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .expect(200);

    return { accessToken: auth.accessToken, expertId, docIds };
  }

  // submittedExpert + approve всех документов + approve эксперта -> VERIFIED.
  async function verifiedExpert(phone: string) {
    const result = await submittedExpert(phone);
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

  it('без токена админа -> 401; очередь показывает PENDING с downloadUrl', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/verification/queue')
      .expect(401);

    const { expertId } = await submittedExpert(PHONE_V1);
    const res = await request(app.getHttpServer())
      .get('/v1/admin/verification/queue')
      .set(ADMIN)
      .expect(200);
    const entry = res.body.find((e: any) => e.id === expertId);
    expect(entry).toBeDefined();
    expect(entry.documents).toHaveLength(4);
    expect(entry.documents[0].downloadUrl).toContain('X-Amz-Signature');
    expect(entry.phone).toBeUndefined();
    expect(entry.userId).toBeUndefined();
  });

  it('approve всех документов + approve эксперта -> VERIFIED; audit-цепочка записана', async () => {
    const { expertId, docIds } = await submittedExpert(PHONE_V2);
    for (const id of docIds)
      await request(app.getHttpServer())
        .post(`/v1/admin/verification/documents/${id}/decision`)
        .set(ADMIN)
        .send({ approve: true })
        .expect(200);
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/verification/${expertId}/decision`)
      .set(ADMIN)
      .send({ approve: true })
      .expect(200);
    expect(res.body.verificationStatus).toBe('VERIFIED');
    const audit = await prisma.auditLog.findMany({
      where: { entity: 'expert', entityId: expertId },
    });
    expect(audit.map((a) => a.transition)).toEqual(
      expect.arrayContaining(['expert.document_approved', 'expert.verified']),
    );
    const adminEntries = audit.filter(
      (a) =>
        a.transition.startsWith('expert.document_approved') ||
        a.transition === 'expert.verified',
    );
    expect(adminEntries.every((a) => a.actorType === 'admin')).toBe(true);
  });

  it('approve эксперта при неполном approve документов -> 400 DOCUMENTS_INCOMPLETE', async () => {
    const { expertId, docIds } = await submittedExpert(PHONE_V3);
    for (const id of docIds.slice(0, 3))
      await request(app.getHttpServer())
        .post(`/v1/admin/verification/documents/${id}/decision`)
        .set(ADMIN)
        .send({ approve: true })
        .expect(200);
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/verification/${expertId}/decision`)
      .set(ADMIN)
      .send({ approve: true })
      .expect(400);
    expect(res.body.error.code).toBe('DOCUMENTS_INCOMPLETE');
  });

  it('reject эксперта -> назад в DRAFT, comment обязателен', async () => {
    const { expertId, docIds } = await submittedExpert(PHONE_V4);
    for (const id of docIds)
      await request(app.getHttpServer())
        .post(`/v1/admin/verification/documents/${id}/decision`)
        .set(ADMIN)
        .send({ approve: true })
        .expect(200);

    await request(app.getHttpServer())
      .post(`/v1/admin/verification/${expertId}/decision`)
      .set(ADMIN)
      .send({ approve: false })
      .expect(400);

    const res = await request(app.getHttpServer())
      .post(`/v1/admin/verification/${expertId}/decision`)
      .set(ADMIN)
      .send({ approve: false, comment: 'Недостаточно данных' })
      .expect(200);
    expect(res.body.verificationStatus).toBe('DRAFT');

    const audit = await prisma.auditLog.findMany({
      where: {
        entity: 'expert',
        entityId: expertId,
        transition: 'expert.verification_rejected',
      },
    });
    expect(audit).toHaveLength(1);
  });

  it('reject документа: comment обязателен; статус REUPLOAD_REQUIRED; у VERIFIED профиль не падает (Р-18)', async () => {
    const { expertId, docIds } = await verifiedExpert(PHONE_V5);
    await request(app.getHttpServer())
      .post(`/v1/admin/verification/documents/${docIds[0]}/decision`)
      .set(ADMIN)
      .send({ approve: false })
      .expect(400); // без comment

    await request(app.getHttpServer())
      .post(`/v1/admin/verification/documents/${docIds[0]}/decision`)
      .set(ADMIN)
      .send({ approve: false, comment: 'Скан нечитаем' })
      .expect(200);

    const expert = await prisma.expert.findUnique({ where: { id: expertId } });
    expect(expert!.verificationStatus).toBe('VERIFIED'); // Р-18

    const doc = await prisma.expertDocument.findUnique({
      where: { id: docIds[0] },
    });
    expect(doc!.status).toBe('REUPLOAD_REQUIRED');
    expect(doc!.comment).toBe('Скан нечитаем');
  });

  it('reject документа у PENDING-эксперта возвращает эксперта в DRAFT', async () => {
    const { expertId, docIds } = await submittedExpert(PHONE_V6);
    await request(app.getHttpServer())
      .post(`/v1/admin/verification/documents/${docIds[0]}/decision`)
      .set(ADMIN)
      .send({ approve: false, comment: 'Плохое качество' })
      .expect(200);

    const expert = await prisma.expert.findUnique({ where: { id: expertId } });
    expect(expert!.verificationStatus).toBe('DRAFT');
    const doc = await prisma.expertDocument.findUnique({
      where: { id: docIds[0] },
    });
    expect(doc!.status).toBe('REUPLOAD_REQUIRED');
  });

  it('block требует reason, ставит isBlocked и NOT_ACCEPTING; идемпотентен; unblock снимает', async () => {
    const { expertId } = await verifiedExpert(PHONE_V1);

    await request(app.getHttpServer())
      .post(`/v1/admin/experts/${expertId}/block`)
      .set(ADMIN)
      .send({})
      .expect(400);

    await request(app.getHttpServer())
      .post(`/v1/admin/experts/${expertId}/block`)
      .set(ADMIN)
      .send({ reason: 'Жалобы на этику' })
      .expect(200);

    const blocked = await prisma.expert.findUnique({ where: { id: expertId } });
    expect(blocked!.isBlocked).toBe(true);
    expect(blocked!.blockedReason).toBe('Жалобы на этику');
    expect(blocked!.workStatus).toBe('NOT_ACCEPTING');

    // Повторный block обновляет reason (идемпотентность).
    await request(app.getHttpServer())
      .post(`/v1/admin/experts/${expertId}/block`)
      .set(ADMIN)
      .send({ reason: 'Повторная жалоба' })
      .expect(200);
    const reBlocked = await prisma.expert.findUnique({
      where: { id: expertId },
    });
    expect(reBlocked!.blockedReason).toBe('Повторная жалоба');

    await request(app.getHttpServer())
      .post(`/v1/admin/experts/${expertId}/unblock`)
      .set(ADMIN)
      .expect(200);
    const unblocked = await prisma.expert.findUnique({
      where: { id: expertId },
    });
    expect(unblocked!.isBlocked).toBe(false);

    const audit = await prisma.auditLog.findMany({
      where: { entity: 'expert', entityId: expertId },
    });
    expect(audit.map((a) => a.transition)).toEqual(
      expect.arrayContaining(['expert.blocked', 'expert.unblocked']),
    );
  });

  it('неверный X-Admin-Token -> 401', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/verification/queue')
      .set('X-Admin-Token', 'wrong-token')
      .expect(401);
  });
});
