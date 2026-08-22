import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { AdminStaffService } from '../src/admin/admin-staff.service';
import { seedSuperadmin } from '../src/cli/seed-superadmin';
import { createApp } from './utils/create-app';

// Защита от потери последнего суперадмина (E11a, задача 6). Спек работает
// со ВСЕМИ активными суперадминами базы: их количество и есть предмет
// проверки, поэтому чужие строки временно деактивируются и возвращаются.
const EMAIL_PREFIX = 'admin-lockout-e2e-';
const PASSWORD = 'correct-horse-battery-staple';
const BCRYPT_ROUNDS = 10;

let seq = 0;
const uniqueEmail = (tag: string) =>
  `${EMAIL_PREFIX}${tag}-${Date.now()}-${seq++}@smartqoldau.kz`;

describe('Последний суперадмин и восстановление доступа (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let foreignSuperadminIds: string[] = [];

  async function cleanup() {
    await prisma.adminUser.deleteMany({
      where: { email: { startsWith: EMAIL_PREFIX } },
    });
    const keys = await redis.keys('admin:*');
    if (keys.length) await redis.del(...keys);
  }

  /// Прячет чужих активных суперадминов: иначе «последним» наш никогда не
  /// станет и проверка ничего не проверит. Возвращаются в afterAll.
  async function hideForeignSuperadmins() {
    const foreign = await prisma.adminUser.findMany({
      where: {
        isActive: true,
        roles: { has: AdminRole.SUPERADMIN },
        email: { not: { startsWith: EMAIL_PREFIX } },
      },
      select: { id: true },
    });
    foreignSuperadminIds = foreign.map((f) => f.id);
    if (foreignSuperadminIds.length) {
      await prisma.adminUser.updateMany({
        where: { id: { in: foreignSuperadminIds } },
        data: { isActive: false },
      });
    }
  }

  async function restoreForeignSuperadmins() {
    if (!foreignSuperadminIds.length) return;
    await prisma.adminUser.updateMany({
      where: { id: { in: foreignSuperadminIds } },
      data: { isActive: true },
    });
    foreignSuperadminIds = [];
  }

  async function createSuperadmin(email: string) {
    return prisma.adminUser.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS),
        roles: [AdminRole.SUPERADMIN],
        isActive: true,
      },
    });
  }

  async function login(email: string) {
    const res = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    app = await createApp(Test.createTestingModule({ imports: [AppModule] }));
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    await cleanup();
    await hideForeignSuperadmins();
  });

  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await restoreForeignSuperadmins();
    await app.close();
  });

  it('деактивация НЕ последнего суперадмина проходит', async () => {
    const first = await createSuperadmin(uniqueEmail('first'));
    const second = await createSuperadmin(uniqueEmail('second'));
    const token = await login(first.email);

    await request(app.getHttpServer())
      .patch(`/v1/admin/staff/${second.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })
      .expect(200);
  });

  it('взаимная деактивация двух последних суперадминов не обнуляет их', async () => {
    // Единственный путь, которым админка реально может остаться без
    // суперадмина: A гасит B, а B в ту же секунду гасит A. Оба видят
    // «второй ещё активен» — и без транзакционного подсчёта оба проходят.
    // Самоблокировка (STAFF_SELF_LOCKOUT_FORBIDDEN) от этого не спасает:
    // каждый гасит не себя.
    const a = await createSuperadmin(uniqueEmail('mutual-a'));
    const b = await createSuperadmin(uniqueEmail('mutual-b'));
    const tokenA = await login(a.email);
    const tokenB = await login(b.email);

    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/v1/admin/staff/${b.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ isActive: false }),
      request(app.getHttpServer())
        .patch(`/v1/admin/staff/${a.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ isActive: false }),
    ]);

    const active = await prisma.adminUser.count({
      where: { isActive: true, roles: { has: AdminRole.SUPERADMIN } },
    });
    expect(active).toBeGreaterThanOrEqual(1);

    // Ровно один из двух обязан быть отклонён — иначе активных не осталось
    // бы вовсе.
    // Один из двух обязан быть отклонён. Каким именно кодом — зависит от
    // того, кто успел раньше: 409 LAST_SUPERADMIN (транзакционный подсчёт)
    // либо 401, если первая деактивация уже сбросила кэш актуальности и
    // guard отверг второго на входе (E11a, задача 4). Оба исхода
    // защищают инвариант; чего быть НЕ должно — двух успехов.
    const statuses = [resA.status, resB.status].sort();
    expect(statuses[0]).toBe(200);
    expect([401, 409]).toContain(statuses[1]);
  });

  it('транзакционный подсчёт не даёт обнулить суперадминов и в обход HTTP', async () => {
    // Прямой вызов сервиса минует guard: остаётся ровно та защита, ради
    // которой изменение выполняется в транзакции с подсчётом.
    const staffService = app.get(AdminStaffService);
    const a = await createSuperadmin(uniqueEmail('tx-a'));
    const b = await createSuperadmin(uniqueEmail('tx-b'));

    const results = await Promise.allSettled([
      staffService.update(b.id, { isActive: false }, { id: a.id }),
      staffService.update(a.id, { isActive: false }, { id: b.id }),
    ]);

    const active = await prisma.adminUser.count({
      where: { isActive: true, roles: { has: AdminRole.SUPERADMIN } },
    });
    expect(active).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.status === 'rejected')).toBe(true);
  });

  it('гонка: два параллельных запроса оставляют хотя бы одного суперадмина', async () => {
    // Проверка-перед-записью здесь не работает: оба запроса увидели бы
    // «есть второй» и погасили обоих.
    const actor = await createSuperadmin(uniqueEmail('actor'));
    const a = await createSuperadmin(uniqueEmail('race-a'));
    const b = await createSuperadmin(uniqueEmail('race-b'));
    const token = await login(actor.email);

    // Гасим актора последним шагом: сначала он должен погасить обоих.
    await request(app.getHttpServer())
      .patch(`/v1/admin/staff/${actor.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roles: [AdminRole.SUPERADMIN] })
      .expect(200);

    const results = await Promise.all([
      request(app.getHttpServer())
        .patch(`/v1/admin/staff/${a.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false }),
      request(app.getHttpServer())
        .patch(`/v1/admin/staff/${b.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false }),
    ]);

    // Оба могут пройти: актор остаётся активным суперадмином.
    expect(results.every((r) => [200, 409].includes(r.status))).toBe(true);

    const active = await prisma.adminUser.count({
      where: { isActive: true, roles: { has: AdminRole.SUPERADMIN } },
    });
    expect(active).toBeGreaterThanOrEqual(1);
  });

  it('CLI создаёт суперадмина и перевыпускает пароль существующему', async () => {
    const email = uniqueEmail('cli');
    const client = prisma as unknown as PrismaClient;

    const created = await seedSuperadmin(client, email, 'first-password-12345');
    expect(created.created).toBe(true);

    const staff = await prisma.adminUser.findUniqueOrThrow({
      where: { email },
    });
    expect(staff.roles).toContain(AdminRole.SUPERADMIN);
    expect(staff.isActive).toBe(true);

    // Второй фактор был привязан, устройство потеряно — восстановление
    // обязано его сбросить, иначе вход остаётся заперт.
    await prisma.adminUser.update({
      where: { id: staff.id },
      data: {
        isActive: false,
        totpSecret: 'whatever',
        totpEnabledAt: new Date(),
      },
    });

    const reissued = await seedSuperadmin(
      client,
      email,
      'second-password-12345',
    );
    expect(reissued.created).toBe(false);

    const after = await prisma.adminUser.findUniqueOrThrow({
      where: { email },
    });
    expect(after.isActive).toBe(true);
    expect(after.totpEnabledAt).toBeNull();
    expect(after.totpSecret).toBeNull();
    expect(after.passwordHash).not.toBe(staff.passwordHash);

    // И новым паролем действительно можно войти.
    await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email, password: 'second-password-12345' })
      .expect(200);
  });
});
