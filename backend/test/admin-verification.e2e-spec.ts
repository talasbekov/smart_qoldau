import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { adminUser, AdminAuth } from './utils/admin-helpers';
import { guestClient } from './utils/client-helpers';

// Номера спека задачи 5 (E2), не пересекаются с другими спеками.
const PHONE_V1 = '+77073000001';
const PHONE_V2 = '+77073000002';
const PHONE_V3 = '+77073000003';
const PHONE_V4 = '+77073000004';
const PHONE_V5 = '+77073000005';
const PHONE_V6 = '+77073000006';
const PHONE_V7 = '+77073000007';
const ALL_PHONES = [
  PHONE_V1,
  PHONE_V2,
  PHONE_V3,
  PHONE_V4,
  PHONE_V5,
  PHONE_V6,
  PHONE_V7,
];

// Префикс-метка этого спека (E8a, задача 4): admin_users и гостевые
// устройства могут содержать строки от прошлых прогонов — спек не
// предполагает пустоты этих таблиц и убирает только свои строки.
const ADMIN_EMAIL_PREFIX = 'admin-verification-e2e-';
const GUEST_DEVICE_PREFIX = 'admin-verification-e2e-guest-';
const DUMMY_ID = '00000000-0000-0000-0000-000000000000';

let adminEmailSeq = 0;
function uniqueAdminEmail(tag: string): string {
  return `${ADMIN_EMAIL_PREFIX}${tag}-${Date.now()}-${adminEmailSeq++}@smartqoldau.kz`;
}

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
  let verificationOperator: AdminAuth;

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

    const guests = await prisma.user.findMany({
      where: { deviceId: { startsWith: GUEST_DEVICE_PREFIX } },
      select: { id: true },
    });
    const guestIds = guests.map((u) => u.id);
    if (guestIds.length) {
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: guestIds } },
      });
      await prisma.auditLog.deleteMany({
        where: { entityId: { in: guestIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: guestIds } } });
    }

    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...userIds, ...expertIds] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    await prisma.adminUser.deleteMany({
      where: { email: { startsWith: ADMIN_EMAIL_PREFIX } },
    });
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await cleanup();
    verificationOperator = await adminUser(
      app,
      [AdminRole.VERIFICATION_OPERATOR],
      uniqueAdminEmail('operator'),
    );
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  function asOperator(method: 'get' | 'post', url: string) {
    return (request(app.getHttpServer()) as any)
      [method](url)
      .set(...verificationOperator.authHeader);
  }

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
      await asOperator(
        'post',
        `/v1/admin/verification/documents/${id}/decision`,
      )
        .send({ approve: true })
        .expect(200);
    }
    await asOperator(
      'post',
      `/v1/admin/verification/${result.expertId}/decision`,
    )
      .send({ approve: true })
      .expect(200);
    return result;
  }

  it('без токена админа -> 401; очередь показывает PENDING с downloadUrl', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/verification/queue')
      .expect(401);

    const { expertId } = await submittedExpert(PHONE_V1);
    const res = await asOperator('get', '/v1/admin/verification/queue').expect(
      200,
    );
    const entry = res.body.find((e: any) => e.id === expertId);
    expect(entry).toBeDefined();
    expect(entry.documents).toHaveLength(4);
    expect(entry.documents[0].downloadUrl).toContain('X-Amz-Signature');
    expect(entry.phone).toBeUndefined();
    expect(entry.userId).toBeUndefined();
  });

  it('очередь несёт submittedAt — точку отсчёта SLA 24ч (ТЗ §11.4)', async () => {
    const before = Date.now();
    const { expertId } = await submittedExpert(PHONE_V1);

    const res = await asOperator('get', '/v1/admin/verification/queue').expect(
      200,
    );
    const entry = res.body.find((e: any) => e.id === expertId);
    expect(entry.submittedAt).toBeTruthy();
    // Отметка ставится на submit, а не на регистрации эксперта.
    expect(new Date(entry.submittedAt).getTime()).toBeGreaterThanOrEqual(
      before,
    );
  });

  it('очередь отсортирована: дольше всех ждущий — первым', async () => {
    const older = await submittedExpert(PHONE_V1);
    const newer = await submittedExpert(PHONE_V2);
    // Оба submit'а произошли в одну и ту же секунду — состариваем первый
    // явно, иначе порядок проверял бы не сортировку, а разрешение таймера.
    await prisma.expert.update({
      where: { id: older.expertId },
      data: {
        verificationSubmittedAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
      },
    });

    const res = await asOperator('get', '/v1/admin/verification/queue').expect(
      200,
    );
    const ids = res.body.map((e: any) => e.id);
    expect(ids.indexOf(older.expertId)).toBeLessThan(
      ids.indexOf(newer.expertId),
    );
  });

  it('approve всех документов + approve эксперта -> VERIFIED; audit-цепочка записана с actorId сотрудника', async () => {
    const { expertId, docIds } = await submittedExpert(PHONE_V2);
    for (const id of docIds)
      await asOperator(
        'post',
        `/v1/admin/verification/documents/${id}/decision`,
      )
        .send({ approve: true })
        .expect(200);
    const res = await asOperator(
      'post',
      `/v1/admin/verification/${expertId}/decision`,
    )
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
    expect(
      adminEntries.every((a) => a.actorId === verificationOperator.id),
    ).toBe(true);
  });

  it('approve эксперта при неполном approve документов -> 400 DOCUMENTS_INCOMPLETE', async () => {
    const { expertId, docIds } = await submittedExpert(PHONE_V3);
    for (const id of docIds.slice(0, 3))
      await asOperator(
        'post',
        `/v1/admin/verification/documents/${id}/decision`,
      )
        .send({ approve: true })
        .expect(200);
    const res = await asOperator(
      'post',
      `/v1/admin/verification/${expertId}/decision`,
    )
      .send({ approve: true })
      .expect(400);
    expect(res.body.error.code).toBe('DOCUMENTS_INCOMPLETE');
  });

  it('reject эксперта -> назад в DRAFT, comment обязателен, actorId в audit — id сотрудника', async () => {
    const { expertId, docIds } = await submittedExpert(PHONE_V4);
    for (const id of docIds)
      await asOperator(
        'post',
        `/v1/admin/verification/documents/${id}/decision`,
      )
        .send({ approve: true })
        .expect(200);

    await asOperator('post', `/v1/admin/verification/${expertId}/decision`)
      .send({ approve: false })
      .expect(400);

    const res = await asOperator(
      'post',
      `/v1/admin/verification/${expertId}/decision`,
    )
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
    expect(audit[0].actorId).toBe(verificationOperator.id);
  });

  it('reject документа: comment обязателен; статус REUPLOAD_REQUIRED; у VERIFIED профиль не падает (Р-18)', async () => {
    const { expertId, docIds } = await verifiedExpert(PHONE_V5);
    await asOperator(
      'post',
      `/v1/admin/verification/documents/${docIds[0]}/decision`,
    )
      .send({ approve: false })
      .expect(400); // без comment

    await asOperator(
      'post',
      `/v1/admin/verification/documents/${docIds[0]}/decision`,
    )
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
    await asOperator(
      'post',
      `/v1/admin/verification/documents/${docIds[0]}/decision`,
    )
      .send({ approve: false, comment: 'Плохое качество' })
      .expect(200);

    const expert = await prisma.expert.findUnique({ where: { id: expertId } });
    expect(expert!.verificationStatus).toBe('DRAFT');
    const doc = await prisma.expertDocument.findUnique({
      where: { id: docIds[0] },
    });
    expect(doc!.status).toBe('REUPLOAD_REQUIRED');
  });

  it('block требует reason, ставит isBlocked и NOT_ACCEPTING; идемпотентен; unblock снимает; actorId в audit — id сотрудника', async () => {
    const { expertId } = await verifiedExpert(PHONE_V1);

    await asOperator('post', `/v1/admin/experts/${expertId}/block`)
      .send({})
      .expect(400);

    await asOperator('post', `/v1/admin/experts/${expertId}/block`)
      .send({ reason: 'Жалобы на этику' })
      .expect(200);

    const blocked = await prisma.expert.findUnique({ where: { id: expertId } });
    expect(blocked!.isBlocked).toBe(true);
    expect(blocked!.blockedReason).toBe('Жалобы на этику');
    expect(blocked!.workStatus).toBe('NOT_ACCEPTING');

    // Повторный block обновляет reason (идемпотентность).
    await asOperator('post', `/v1/admin/experts/${expertId}/block`)
      .send({ reason: 'Повторная жалоба' })
      .expect(200);
    const reBlocked = await prisma.expert.findUnique({
      where: { id: expertId },
    });
    expect(reBlocked!.blockedReason).toBe('Повторная жалоба');

    await asOperator('post', `/v1/admin/experts/${expertId}/unblock`).expect(
      200,
    );
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
    const blockEntries = audit.filter((a) =>
      ['expert.blocked', 'expert.unblocked'].includes(a.transition),
    );
    expect(
      blockEntries.every((a) => a.actorId === verificationOperator.id),
    ).toBe(true);
  });

  it('без токена -> 401 на всех пяти маршрутах', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/verification/queue')
      .expect(401);
    await request(app.getHttpServer())
      .post(`/v1/admin/verification/documents/${DUMMY_ID}/decision`)
      .send({ approve: true })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/v1/admin/verification/${DUMMY_ID}/decision`)
      .send({ approve: true })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/v1/admin/experts/${DUMMY_ID}/block`)
      .send({ reason: 'x' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/v1/admin/experts/${DUMMY_ID}/unblock`)
      .expect(401);
  });

  it('токен клиента (не сотрудника админки) -> 403 ADMIN_FORBIDDEN на всех пяти маршрутах', async () => {
    const deviceId = `${GUEST_DEVICE_PREFIX}${Date.now()}`;
    const client = await guestClient(app, deviceId);
    const clientAuth: [string, string] = [
      'Authorization',
      `Bearer ${client.accessToken}`,
    ];

    const cases: Array<[string, string]> = [
      ['get', '/v1/admin/verification/queue'],
      ['post', `/v1/admin/verification/documents/${DUMMY_ID}/decision`],
      ['post', `/v1/admin/verification/${DUMMY_ID}/decision`],
      ['post', `/v1/admin/experts/${DUMMY_ID}/block`],
      ['post', `/v1/admin/experts/${DUMMY_ID}/unblock`],
    ];
    for (const [method, url] of cases) {
      const res = await (request(app.getHttpServer()) as any)
        [method](url)
        .set(...clientAuth)
        .send({ approve: true, reason: 'x' })
        .expect(403);
      expect(res.body.error.code).toBe('ADMIN_FORBIDDEN');
    }
  });

  it('роль FINANCE_CONTROL (без VERIFICATION_OPERATOR) -> 403 ADMIN_FORBIDDEN на всех пяти маршрутах', async () => {
    const finance = await adminUser(
      app,
      [AdminRole.FINANCE_CONTROL],
      uniqueAdminEmail('finance'),
    );

    const cases: Array<[string, string]> = [
      ['get', '/v1/admin/verification/queue'],
      ['post', `/v1/admin/verification/documents/${DUMMY_ID}/decision`],
      ['post', `/v1/admin/verification/${DUMMY_ID}/decision`],
      ['post', `/v1/admin/experts/${DUMMY_ID}/block`],
      ['post', `/v1/admin/experts/${DUMMY_ID}/unblock`],
    ];
    for (const [method, url] of cases) {
      const res = await (request(app.getHttpServer()) as any)
        [method](url)
        .set(...finance.authHeader)
        .send({ approve: true, reason: 'x' })
        .expect(403);
      expect(res.body.error.code).toBe('ADMIN_FORBIDDEN');
    }
  });

  it('роль SUPERADMIN проходит на очередь, block и unblock без роли VERIFICATION_OPERATOR', async () => {
    const superadmin = await adminUser(
      app,
      [AdminRole.SUPERADMIN],
      uniqueAdminEmail('superadmin'),
    );
    const { expertId } = await verifiedExpert(PHONE_V7);

    await request(app.getHttpServer())
      .get('/v1/admin/verification/queue')
      .set(...superadmin.authHeader)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/v1/admin/experts/${expertId}/block`)
      .set(...superadmin.authHeader)
      .send({ reason: 'SUPERADMIN test' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/v1/admin/experts/${expertId}/unblock`)
      .set(...superadmin.authHeader)
      .expect(200);
  });
});
