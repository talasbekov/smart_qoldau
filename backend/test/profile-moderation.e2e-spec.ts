import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole } from '@prisma/client';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/storage/storage.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { adminUser, AdminAuth } from './utils/admin-helpers';
import { registeredExpertUser } from './utils/expert-helpers';

// Очередь модерации публичного профиля (E2a, задача 5). Роль та же, что у
// документов: фото и текст относятся к достоверности профиля.
const PH_E1 = '+77098400001';
const PH_E2 = '+77098400002';
const ALL_PHONES = [PH_E1, PH_E2];
const EMAIL_PREFIX = 'profile-moderation-e2e-';
const ABOUT = 'Работаю с тревогой и выгоранием более десяти лет, метод — КПТ.';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    if (match) lastCode = match[1];
  }
}

const jpeg = () =>
  sharp({
    create: {
      width: 600,
      height: 600,
      channels: 3,
      background: { r: 90, g: 120, b: 60 },
    },
  })
    .jpeg()
    .toBuffer();

describe('Модерация публичного профиля (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageService;
  let operator: AdminAuth;
  let finance: AdminAuth;
  let superadmin: AdminAuth;
  let first: { accessToken: string; expertId: string };
  let second: { accessToken: string; expertId: string };

  async function cleanup() {
    await prisma.adminUser.deleteMany({
      where: { email: { startsWith: EMAIL_PREFIX } },
    });
    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (!ids.length) return;
    const experts = await prisma.expert.findMany({
      where: { userId: { in: ids } },
      select: { id: true },
    });
    const expertIds = experts.map((e) => e.id);
    await prisma.expertTopic.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expert.deleteMany({ where: { id: { in: expertIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
  }

  const exists = async (key: string) =>
    (await fetch(storage.avatarUrl(key))).status === 200;

  const expertRow = (id: string) =>
    prisma.expert.findUniqueOrThrow({ where: { id } });

  async function submitPhotoAndAbout(auth: {
    accessToken: string;
  }): Promise<void> {
    await request(app.getHttpServer())
      .post('/v1/experts/me/photo')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .attach('file', await jpeg(), 'photo.jpg')
      .expect(202);
    await request(app.getHttpServer())
      .patch('/v1/experts/me')
      .set('Authorization', `Bearer ${auth.accessToken}`)
      .send({ about: ABOUT })
      .expect(200);
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    storage = app.get(StorageService);
    await cleanup();

    operator = await adminUser(
      app,
      [AdminRole.VERIFICATION_OPERATOR],
      `${EMAIL_PREFIX}operator@smartqoldau.kz`,
    );
    finance = await adminUser(
      app,
      [AdminRole.FINANCE_CONTROL],
      `${EMAIL_PREFIX}finance@smartqoldau.kz`,
    );
    superadmin = await adminUser(
      app,
      [AdminRole.SUPERADMIN],
      `${EMAIL_PREFIX}boss@smartqoldau.kz`,
    );

    first = await registeredExpertUser(app, PH_E1, () => lastCode);
    await submitPhotoAndAbout(first);
    second = await registeredExpertUser(app, PH_E2, () => lastCode);
    await submitPhotoAndAbout(second);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('очередь показывает только ожидающих, первым — ждущий дольше всех', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/admin/profile-moderation')
      .set(...operator.authHeader)
      .expect(200);

    const ids = res.body.items.map((i: { expertId: string }) => i.expertId);
    expect(ids).toContain(first.expertId);
    expect(ids).toContain(second.expertId);
    expect(ids.indexOf(first.expertId)).toBeLessThan(
      ids.indexOf(second.expertId),
    );
    expect(res.body.total).toBeGreaterThanOrEqual(2);

    const entry = res.body.items.find(
      (i: { expertId: string }) => i.expertId === first.expertId,
    );
    expect(entry.displayName).toBeTruthy();
    expect(entry.aboutPending).toBe(ABOUT);
    expect(entry.photoPendingUrl).toContain('.webp');
  });

  it('роль FINANCE_CONTROL к очереди не допускается, SUPERADMIN проходит', async () => {
    await request(app.getHttpServer())
      .get('/v1/admin/profile-moderation')
      .set(...finance.authHeader)
      .expect(403);
    await request(app.getHttpServer())
      .get('/v1/admin/profile-moderation')
      .set(...superadmin.authHeader)
      .expect(200);
  });

  it('отклонение без причины → 400, с причиной удаляет фото и доносит текст специалисту', async () => {
    const before = await expertRow(first.expertId);
    const pendingKey = before.photoPendingKey!;

    const noComment = await request(app.getHttpServer())
      .post(`/v1/admin/profile-moderation/${first.expertId}/photo/decision`)
      .set(...operator.authHeader)
      .send({ action: 'reject' });
    expect(noComment.status).toBe(400);
    expect(noComment.body.error.code).toBe('MODERATION_COMMENT_REQUIRED');

    await request(app.getHttpServer())
      .post(`/v1/admin/profile-moderation/${first.expertId}/photo/decision`)
      .set(...operator.authHeader)
      .send({ action: 'reject', comment: 'Лицо не видно' })
      .expect(200);

    const after = await expertRow(first.expertId);
    expect(after.photoStatus).toBe('REJECTED');
    expect(after.photoPendingKey).toBeNull();
    expect(await exists(pendingKey)).toBe(false);

    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone: PH_E1 })
      .expect(204);
    const verify = await request(app.getHttpServer())
      .post('/v1/auth/verify-code')
      .send({ phone: PH_E1, code: lastCode })
      .expect(200);
    const me = await request(app.getHttpServer())
      .get('/v1/experts/me')
      .set('Authorization', `Bearer ${verify.body.accessToken}`)
      .expect(200);
    expect(me.body.photoStatus).toBe('REJECTED');
    expect(me.body.moderationComment).toBe('Лицо не видно');
  });

  it('решение по полю не в PENDING → 409', async () => {
    const res = await request(app.getHttpServer())
      .post(`/v1/admin/profile-moderation/${first.expertId}/photo/decision`)
      .set(...operator.authHeader)
      .send({ action: 'approve' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOTHING_TO_MODERATE');
  });

  it('одобрение публикует фото и удаляет прежнее опубликованное', async () => {
    const previousPublished = 'previously-published.webp';
    await storage.putAvatar(
      previousPublished,
      Buffer.from('old'),
      'image/webp',
    );
    await prisma.expert.update({
      where: { id: second.expertId },
      data: { photoKey: previousPublished, photoStatus: 'PENDING' },
    });
    const before = await expertRow(second.expertId);

    await request(app.getHttpServer())
      .post(`/v1/admin/profile-moderation/${second.expertId}/photo/decision`)
      .set(...operator.authHeader)
      .send({ action: 'approve' })
      .expect(200);

    const after = await expertRow(second.expertId);
    expect(after.photoStatus).toBe('APPROVED');
    expect(after.photoKey).toBe(before.photoPendingKey);
    expect(after.photoPendingKey).toBeNull();
    expect(await exists(previousPublished)).toBe(false);
    expect(await exists(after.photoKey!)).toBe(true);
  });

  it('одобрение текста публикует его, в audit — настоящий id сотрудника', async () => {
    await request(app.getHttpServer())
      .post(`/v1/admin/profile-moderation/${second.expertId}/about/decision`)
      .set(...operator.authHeader)
      .send({ action: 'approve' })
      .expect(200);

    const after = await expertRow(second.expertId);
    expect(after.about).toBe(ABOUT);
    expect(after.aboutPending).toBeNull();
    expect(after.aboutStatus).toBe('APPROVED');

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: {
        entityId: second.expertId,
        transition: 'expert.about_approved',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry.actorId).toBe(operator.id);
    expect(entry.actorType).toBe('admin');
  });
});
