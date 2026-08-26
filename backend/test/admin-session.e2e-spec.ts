import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { createApp } from './utils/create-app';

// Актуальность сотрудника на каждом запросе (E11a, задача 4): до этой
// задачи авторизация админки была полностью stateless, и деактивированный
// сотрудник продолжал работать до истечения access-токена (15 минут).
const EMAIL_PREFIX = 'admin-session-e2e-';
const PASSWORD = 'correct-horse-battery-staple';
const BCRYPT_ROUNDS = 10;

let seq = 0;
const uniqueEmail = (tag: string) =>
  `${EMAIL_PREFIX}${tag}-${Date.now()}-${seq++}@smartqoldau.kz`;

describe('Сессия сотрудника админки (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  async function cleanup() {
    const staff = await prisma.adminUser.findMany({
      where: { email: { startsWith: EMAIL_PREFIX } },
      select: { id: true },
    });
    const ids = staff.map((s) => s.id);
    if (ids.length) {
      await prisma.adminRefreshToken.deleteMany({
        where: { adminUserId: { in: ids } },
      });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
      await prisma.adminUser.deleteMany({ where: { id: { in: ids } } });
      const keys = await redis.keys('admin:state:*');
      if (keys.length) await redis.del(...keys);
    }
  }

  async function createStaff(
    email: string,
    roles: AdminRole[] = [AdminRole.SUPPORT_OPERATOR],
  ) {
    return prisma.adminUser.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS),
        roles,
        isActive: true,
      },
    });
  }

  async function login(email: string) {
    const res = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return res.body as {
      accessToken: string;
      refreshToken: string;
      admin: { id: string; roles: AdminRole[] };
    };
  }

  /// Кэш актуальности живёт 30 секунд; в тесте ждать их незачем —
  /// сбрасываем ключ явно, проверяя саму механику отзыва, а не TTL.
  async function dropStateCache() {
    const keys = await redis.keys('admin:state:*');
    if (keys.length) await redis.del(...keys);
  }

  beforeAll(async () => {
    app = await createApp(Test.createTestingModule({ imports: [AppModule] }));
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    await cleanup();
  });

  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('деактивированный сотрудник теряет доступ на следующем запросе', async () => {
    const email = uniqueEmail('deactivated');
    const staff = await createStaff(email);
    const session = await login(email);

    await request(app.getHttpServer())
      .get('/v1/admin/tickets')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    await prisma.adminUser.update({
      where: { id: staff.id },
      data: { isActive: false },
    });
    await dropStateCache();

    await request(app.getHttpServer())
      .get('/v1/admin/tickets')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(401);
  });

  it('снятая роль перестаёт действовать без повторного входа', async () => {
    const email = uniqueEmail('role');
    const staff = await createStaff(email, [
      AdminRole.SUPPORT_OPERATOR,
      AdminRole.FINANCE_CONTROL,
    ]);
    const session = await login(email);

    await request(app.getHttpServer())
      .get('/v1/admin/payouts')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    await prisma.adminUser.update({
      where: { id: staff.id },
      data: { roles: [AdminRole.SUPPORT_OPERATOR] },
    });
    await dropStateCache();

    // Роли берутся из свежих данных, а не из payload токена.
    await request(app.getHttpServer())
      .get('/v1/admin/payouts')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(403);
  });

  it('refresh продлевает сессию и выдаёт новую пару', async () => {
    const email = uniqueEmail('refresh');
    await createStaff(email);
    const session = await login(email);

    const refreshed = await request(app.getHttpServer())
      .post('/v1/admin/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(200);

    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    expect(refreshed.body.refreshToken).toEqual(expect.any(String));
    expect(refreshed.body.refreshToken).not.toBe(session.refreshToken);

    await request(app.getHttpServer())
      .get('/v1/admin/tickets')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .expect(200);
  });

  it('использованный refresh-токен второй раз не принимается', async () => {
    // Ротация: перехваченный старый токен не должен открывать сессию.
    const email = uniqueEmail('rotate');
    await createStaff(email);
    const session = await login(email);

    await request(app.getHttpServer())
      .post('/v1/admin/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/admin/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);
  });

  it('два параллельных refresh одним токеном: ровно одна новая сессия', async () => {
    // Ротация обязана быть атомарной: раньше «прочитал -> отозвал» двумя
    // запросами позволяли обоим гонщикам пройти, то есть перехваченный
    // токен молча размножался в две живые сессии.
    const email = uniqueEmail('race');
    await createStaff(email);
    const session = await login(email);

    const results = await Promise.all([
      request(app.getHttpServer())
        .post('/v1/admin/auth/refresh')
        .send({ refreshToken: session.refreshToken }),
      request(app.getHttpServer())
        .post('/v1/admin/auth/refresh')
        .send({ refreshToken: session.refreshToken }),
    ]);

    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 401]);
  });

  it('деактивация отзывает refresh-токены немедленно', async () => {
    const email = uniqueEmail('revoke');
    const staff = await createStaff(email);
    const superadmin = uniqueEmail('super');
    await createStaff(superadmin, [AdminRole.SUPERADMIN]);
    const session = await login(email);
    const boss = await login(superadmin);

    await request(app.getHttpServer())
      .patch(`/v1/admin/staff/${staff.id}`)
      .set('Authorization', `Bearer ${boss.accessToken}`)
      .send({ isActive: false })
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/admin/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(401);

    // И доступ по уже выданному access-токену тоже закрыт немедленно —
    // без ожидания TTL кэша: деактивация сбрасывает его сама.
    await request(app.getHttpServer())
      .get('/v1/admin/tickets')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(401);

    const revoked = await prisma.auditLog.findFirst({
      where: { entityId: staff.id, transition: 'admin.access_revoked' },
    });
    expect(revoked).not.toBeNull();
  });
});
