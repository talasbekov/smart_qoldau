import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp } from './utils/create-app';
import { adminUser, AdminAuth } from './utils/admin-helpers';

// Префикс-метка этого спека (E8a, задача 6): admin_users содержит строки от
// прошлых прогонов и сида — спек не предполагает пустоты таблицы и убирает
// только свои строки (см. progress.md, задача 1).
const EMAIL_PREFIX = 'admin-staff-e2e-';
const PASSWORD = 'admin-staff-e2e-password-123456';
const DUMMY_ID = '00000000-0000-0000-0000-000000000000';

let emailSeq = 0;
function uniqueEmail(tag: string): string {
  return `${EMAIL_PREFIX}${tag}-${Date.now()}-${emailSeq++}@smartqoldau.kz`;
}

describe('Admin staff management (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superadmin: AdminAuth;

  async function cleanup() {
    await prisma.adminUser.deleteMany({
      where: { email: { startsWith: EMAIL_PREFIX } },
    });
  }

  beforeAll(async () => {
    app = await createApp(Test.createTestingModule({ imports: [AppModule] }));
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await cleanup();
    superadmin = await adminUser(
      app,
      [AdminRole.SUPERADMIN],
      uniqueEmail('superadmin'),
    );
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  function asSuperadmin(method: 'get' | 'post' | 'patch', url: string) {
    return (request(app.getHttpServer()) as any)
      [method](url)
      .set(...superadmin.authHeader);
  }

  it('создание сотрудника суперадмином -> 201 без passwordHash; новый сотрудник входит выданным паролем; audit staff.created без пароля', async () => {
    const email = uniqueEmail('created');
    const res = await asSuperadmin('post', '/v1/admin/staff')
      .send({
        email,
        password: PASSWORD,
        roles: [AdminRole.SUPPORT_OPERATOR],
      })
      .expect(201);

    expect(res.body).toEqual({
      id: expect.any(String),
      email,
      roles: [AdminRole.SUPPORT_OPERATOR],
      isActive: true,
    });
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    const login = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    expect(login.body.admin.id).toBe(res.body.id);

    const audit = await prisma.auditLog.findMany({
      where: {
        entity: 'staff',
        entityId: res.body.id,
        transition: 'staff.created',
      },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0].actorType).toBe('admin');
    expect(audit[0].actorId).toBe(superadmin.id);
    expect(JSON.stringify(audit[0].payload)).not.toContain(PASSWORD);
    expect(JSON.stringify(audit[0].payload)).not.toContain('password');
  });

  it('роль SUPPORT_OPERATOR не может создавать сотрудников -> 403 ADMIN_FORBIDDEN', async () => {
    const support = await adminUser(
      app,
      [AdminRole.SUPPORT_OPERATOR],
      uniqueEmail('support'),
    );
    const res = await request(app.getHttpServer())
      .post('/v1/admin/staff')
      .set(...support.authHeader)
      .send({
        email: uniqueEmail('blocked'),
        password: PASSWORD,
        roles: [AdminRole.SUPPORT_OPERATOR],
      })
      .expect(403);
    expect(res.body.error.code).toBe('ADMIN_FORBIDDEN');
  });

  it('дубль email -> 409 STAFF_EMAIL_EXISTS', async () => {
    const email = uniqueEmail('dup');
    await asSuperadmin('post', '/v1/admin/staff')
      .send({
        email,
        password: PASSWORD,
        roles: [AdminRole.SUPPORT_OPERATOR],
      })
      .expect(201);

    const res = await asSuperadmin('post', '/v1/admin/staff')
      .send({ email, password: PASSWORD, roles: [AdminRole.QUALITY_TEAM] })
      .expect(409);
    expect(res.body.error.code).toBe('STAFF_EMAIL_EXISTS');
  });

  it('пустой массив ролей -> 400', async () => {
    await asSuperadmin('post', '/v1/admin/staff')
      .send({ email: uniqueEmail('noroles'), password: PASSWORD, roles: [] })
      .expect(400);
  });

  it('без токена -> 401 на всех трёх маршрутах', async () => {
    await request(app.getHttpServer())
      .post('/v1/admin/staff')
      .send({
        email: uniqueEmail('noauth'),
        password: PASSWORD,
        roles: [AdminRole.SUPPORT_OPERATOR],
      })
      .expect(401);
    await request(app.getHttpServer()).get('/v1/admin/staff').expect(401);
    await request(app.getHttpServer())
      .patch(`/v1/admin/staff/${DUMMY_ID}`)
      .send({ isActive: false })
      .expect(401);
  });

  it('роль QUALITY_TEAM не может создавать/читать/изменять сотрудников -> 403 ADMIN_FORBIDDEN на всех трёх маршрутах', async () => {
    const quality = await adminUser(
      app,
      [AdminRole.QUALITY_TEAM],
      uniqueEmail('quality'),
    );
    const cases: Array<[string, string]> = [
      ['post', '/v1/admin/staff'],
      ['get', '/v1/admin/staff'],
      ['patch', `/v1/admin/staff/${DUMMY_ID}`],
    ];
    for (const [method, url] of cases) {
      const res = await (request(app.getHttpServer()) as any)
        [method](url)
        .set(...quality.authHeader)
        .send({
          email: uniqueEmail('x'),
          password: PASSWORD,
          roles: [AdminRole.SUPPORT_OPERATOR],
        })
        .expect(403);
      expect(res.body.error.code).toBe('ADMIN_FORBIDDEN');
    }
  });

  it('GET список: свои записи находятся по email, passwordHash отсутствует, пагинация детерминирована вторичным ключом id', async () => {
    const emails = [
      uniqueEmail('list-a'),
      uniqueEmail('list-b'),
      uniqueEmail('list-c'),
    ];
    for (const email of emails) {
      await asSuperadmin('post', '/v1/admin/staff')
        .send({
          email,
          password: PASSWORD,
          roles: [AdminRole.SUPPORT_OPERATOR],
        })
        .expect(201);
    }

    const res = await asSuperadmin(
      'get',
      '/v1/admin/staff?take=100&skip=0',
    ).expect(200);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(typeof res.body.total).toBe('number');
    expect(res.body.total).toBeGreaterThanOrEqual(emails.length + 1);

    for (const email of emails) {
      const item = res.body.items.find((i: any) => i.email === email);
      expect(item).toBeDefined();
      expect(item.isActive).toBe(true);
      expect(item.lastLoginAt).toBeNull();
      expect(typeof item.createdAt).toBe('string');
      expect(item).not.toHaveProperty('passwordHash');
    }

    // Два подряд запроса с неполным ORDER BY (только createdAt, который может
    // совпасть у записей, созданных в одном тесте) должны давать один и тот
    // же порядок — это и проверяет вторичный ключ id в сортировке.
    const res2 = await asSuperadmin(
      'get',
      '/v1/admin/staff?take=100&skip=0',
    ).expect(200);
    expect(res2.body.items.map((i: any) => i.id)).toEqual(
      res.body.items.map((i: any) => i.id),
    );

    // take учитывается.
    const limited = await asSuperadmin('get', '/v1/admin/staff?take=1').expect(
      200,
    );
    expect(limited.body.items).toHaveLength(1);
  });

  it('PATCH: смена ролей отражается в новом токене после повторного входа; деактивация -> сотрудник больше не логинится; audit staff.updated без пароля', async () => {
    const email = uniqueEmail('patchable');
    const created = await asSuperadmin('post', '/v1/admin/staff')
      .send({
        email,
        password: PASSWORD,
        roles: [AdminRole.SUPPORT_OPERATOR],
      })
      .expect(201);
    const staffId = created.body.id;

    await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);

    const patchRoles = await asSuperadmin('patch', `/v1/admin/staff/${staffId}`)
      .send({ roles: [AdminRole.QUALITY_TEAM, AdminRole.FINANCE_CONTROL] })
      .expect(200);
    expect(patchRoles.body.roles).toEqual(
      expect.arrayContaining([
        AdminRole.QUALITY_TEAM,
        AdminRole.FINANCE_CONTROL,
      ]),
    );
    expect(patchRoles.body).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(patchRoles.body)).not.toContain('passwordHash');

    const reLogin = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    expect(reLogin.body.admin.roles).toEqual(
      expect.arrayContaining([
        AdminRole.QUALITY_TEAM,
        AdminRole.FINANCE_CONTROL,
      ]),
    );
    expect(reLogin.body.admin.roles).not.toContain(AdminRole.SUPPORT_OPERATOR);

    await asSuperadmin('patch', `/v1/admin/staff/${staffId}`)
      .send({ isActive: false })
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email, password: PASSWORD })
      .expect(401);

    const audit = await prisma.auditLog.findMany({
      where: {
        entity: 'staff',
        entityId: staffId,
        transition: 'staff.updated',
      },
    });
    expect(audit.length).toBeGreaterThanOrEqual(2);
    for (const entry of audit) {
      expect(entry.actorType).toBe('admin');
      expect(entry.actorId).toBe(superadmin.id);
      expect(JSON.stringify(entry.payload)).not.toContain(PASSWORD);
      expect(JSON.stringify(entry.payload)).not.toContain('password');
    }
  });

  it('PATCH неизвестный id -> 404 STAFF_NOT_FOUND', async () => {
    const res = await asSuperadmin('patch', `/v1/admin/staff/${DUMMY_ID}`)
      .send({ isActive: false })
      .expect(404);
    expect(res.body.error.code).toBe('STAFF_NOT_FOUND');
  });

  it('суперадмин не может деактивировать самого себя или снять с себя роль SUPERADMIN -> 400 STAFF_SELF_LOCKOUT_FORBIDDEN', async () => {
    const deactivateSelf = await asSuperadmin(
      'patch',
      `/v1/admin/staff/${superadmin.id}`,
    )
      .send({ isActive: false })
      .expect(400);
    expect(deactivateSelf.body.error.code).toBe('STAFF_SELF_LOCKOUT_FORBIDDEN');

    const removeSelfRole = await asSuperadmin(
      'patch',
      `/v1/admin/staff/${superadmin.id}`,
    )
      .send({ roles: [AdminRole.SUPPORT_OPERATOR] })
      .expect(400);
    expect(removeSelfRole.body.error.code).toBe('STAFF_SELF_LOCKOUT_FORBIDDEN');

    // Состояние в БД не изменилось ни одной из отклонённых попыток.
    const row = await prisma.adminUser.findUnique({
      where: { id: superadmin.id },
    });
    expect(row!.isActive).toBe(true);
    expect(row!.roles).toContain(AdminRole.SUPERADMIN);

    // Суперадмин по-прежнему может выполнять свою роль (значит, себя не
    // заблокировал).
    await asSuperadmin('get', '/v1/admin/staff').expect(200);
  });
});
