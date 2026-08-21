import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp } from './utils/create-app';
import { guestClient } from './utils/client-helpers';
import { adminUser } from './utils/admin-helpers';

// Префикс-метка этого спека: таблица admin_users в тестовой БД может
// содержать строки от прошлых прогонов (см. progress.md задачи 1), поэтому
// спек не предполагает, что она пуста, и убирает только свои строки.
const EMAIL_PREFIX = 'admin-auth-e2e-';
const DEVICE_PREFIX = 'admin-auth-e2e-device-';
const PASSWORD = 'correct-horse-battery-staple';
const BCRYPT_ROUNDS = 10;

let emailSeq = 0;
function uniqueEmail(tag: string): string {
  return `${EMAIL_PREFIX}${tag}-${Date.now()}-${emailSeq++}@smartqoldau.kz`;
}

describe('Admin auth: вход сотрудника по email и паролю (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;

  async function cleanup() {
    await prisma.adminUser.deleteMany({
      where: { email: { startsWith: EMAIL_PREFIX } },
    });
    const guests = await prisma.user.findMany({
      where: { deviceId: { startsWith: DEVICE_PREFIX } },
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
  }

  async function createAdmin(
    overrides: {
      email?: string;
      roles?: AdminRole[];
      isActive?: boolean;
    } = {},
  ) {
    const email = overrides.email ?? uniqueEmail('login');
    const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);
    const admin = await prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        roles: overrides.roles ?? ['SUPPORT_OPERATOR'],
        isActive: overrides.isActive ?? true,
      },
    });
    return { admin, email };
  }

  beforeAll(async () => {
    app = await createApp(Test.createTestingModule({ imports: [AppModule] }));
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });

  beforeEach(() => cleanup());

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('верные email и пароль -> 200, accessToken с ролями, токен валиден, lastLoginAt обновлён, audit admin.logged_in', async () => {
    const { admin, email } = await createAdmin({
      roles: ['SUPPORT_OPERATOR', 'QUALITY_TEAM'],
    });

    const res = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);

    expect(res.body.admin).toEqual({
      id: admin.id,
      email,
      roles: expect.arrayContaining(['SUPPORT_OPERATOR', 'QUALITY_TEAM']),
    });
    expect(typeof res.body.accessToken).toBe('string');

    // passwordHash не должен появляться нигде в теле ответа.
    expect(JSON.stringify(res.body)).not.toContain(admin.passwordHash);

    // Токен работает: подписан тем же секретом, несёт роли и isAdmin.
    const payload = await jwt.verifyAsync(res.body.accessToken);
    expect(payload.sub).toBe(admin.id);
    expect(payload.isAdmin).toBe(true);
    expect(payload.roles).toEqual(
      expect.arrayContaining(['SUPPORT_OPERATOR', 'QUALITY_TEAM']),
    );

    const updated = await prisma.adminUser.findUnique({
      where: { id: admin.id },
    });
    expect(updated!.lastLoginAt).not.toBeNull();

    const audit = await prisma.auditLog.findMany({
      where: {
        entity: 'staff',
        entityId: admin.id,
        transition: 'admin.logged_in',
      },
    });
    expect(audit).toHaveLength(1);
  });

  it('неверный пароль и несуществующий email -> дословно идентичный 401 ADMIN_INVALID_CREDENTIALS', async () => {
    const { email } = await createAdmin();

    const wrongPasswordRes = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email, password: 'totally-wrong-password' })
      .expect(401);

    const nonExistentEmailRes = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email: uniqueEmail('nonexistent'), password: 'whatever-pass' })
      .expect(401);

    // Ответы должны быть дословно идентичны — не раскрываем существование
    // учётной записи.
    expect(wrongPasswordRes.body).toEqual(nonExistentEmailRes.body);
    expect(wrongPasswordRes.body.error.code).toBe('ADMIN_INVALID_CREDENTIALS');

    // Пароль не попадает в audit ни в каком виде.
    const audit = await prisma.auditLog.findMany({
      where: { entity: 'staff', transition: 'admin.login_failed' },
    });
    expect(audit.length).toBeGreaterThanOrEqual(2);
    for (const entry of audit) {
      expect(JSON.stringify(entry.payload)).not.toContain('totally-wrong');
      expect(JSON.stringify(entry.payload)).not.toContain('whatever-pass');
    }
  });

  it('isActive: false -> тот же самый 401 ADMIN_INVALID_CREDENTIALS', async () => {
    const { email } = await createAdmin({ isActive: false });

    const res = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email, password: PASSWORD })
      .expect(401);

    expect(res.body.error.code).toBe('ADMIN_INVALID_CREDENTIALS');

    // Тот же ответ, что и при неверном пароле/несуществующем email.
    const wrongPasswordRes = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email: uniqueEmail('cmp'), password: 'irrelevant-pass' })
      .expect(401);
    expect(res.body).toEqual(wrongPasswordRes.body);
  });

  it('хелпер adminUser() создаёт сотрудника и возвращает рабочий authHeader', async () => {
    const { id, token, authHeader } = await adminUser(
      app,
      ['FINANCE_CONTROL', 'SUPERADMIN'],
      uniqueEmail('helper'),
    );

    expect(authHeader).toEqual(['Authorization', `Bearer ${token}`]);

    const payload = await jwt.verifyAsync(token);
    expect(payload.sub).toBe(id);
    expect(payload.isAdmin).toBe(true);
    expect(payload.roles).toEqual(
      expect.arrayContaining(['FINANCE_CONTROL', 'SUPERADMIN']),
    );
  });

  it('пользовательский (гостевой) JWT не содержит isAdmin/roles', async () => {
    const deviceId = `${DEVICE_PREFIX}${Date.now()}`;
    const { accessToken } = await guestClient(app, deviceId);

    const payload = await jwt.verifyAsync(accessToken);
    expect(payload).not.toHaveProperty('isAdmin');
    expect(payload).not.toHaveProperty('roles');
    expect(payload.isGuest).toBe(true);
  });

  // Финальное ревью E8a, п.5: JwtAuthGuard раньше принимал ЛЮБОЙ подписанный
  // токен, включая токен сотрудника админки, на пользовательских маршрутах
  // (confused deputy). GET /v1/tickets — маршрут задачи 8 (E8a), защищённый
  // именно JwtAuthGuard (не OptionalJwtAuthGuard) — выбран как представитель.
  it('админский JWT отклоняется пользовательским маршрутом (JwtAuthGuard) -> 403 FORBIDDEN', async () => {
    const staff = await adminUser(
      app,
      ['SUPPORT_OPERATOR'],
      uniqueEmail('confused-deputy'),
    );

    const res = await request(app.getHttpServer())
      .get('/v1/tickets')
      .set(...staff.authHeader)
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
