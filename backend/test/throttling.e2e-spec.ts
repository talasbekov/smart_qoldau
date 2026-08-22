import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { createApp } from './utils/create-app';
import { guestClient } from './utils/client-helpers';

// Лимиты живут в Redis (общие для реплик), поэтому спек чистит их сам:
// иначе один прогон отравлял бы следующий, а порядок тестов внутри файла
// начинал бы значить.
const EMAIL_PREFIX = 'throttle-e2e-';
// Гостевые тикеты создаются БЕЗ авторизации, значит `authorUserId` у них
// null и по пользователю их не найти — метим темой и чистим по ней. Без
// этого они оседают в очереди поддержки и ломают чужие спеки.
const SUBJECT_PREFIX = 'throttle-e2e-ticket ';
const DEVICE_PREFIX = 'throttle-e2e-device-';
const PASSWORD = 'correct-horse-battery-staple';
const BCRYPT_ROUNDS = 10;

let seq = 0;
const uniqueEmail = (tag: string) =>
  `${EMAIL_PREFIX}${tag}-${Date.now()}-${seq++}@smartqoldau.kz`;

describe('Троттлинг открытых эндпоинтов (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  // Формат ключей хранилища `@nest-lab/throttler-storage-redis`:
  // `{<хеш трекера>:<имя профиля>}:hits` и `...:blocked` (см. его
  // `increment()`). Собственного префикса у библиотеки нет, поэтому
  // сверяемся с этим шаблоном, а не выдумываем свой.
  const THROTTLE_KEY_PATTERNS = ['{*}:hits', '{*}:blocked'];

  async function throttleKeys(): Promise<string[]> {
    const found = await Promise.all(
      THROTTLE_KEY_PATTERNS.map((pattern) => redis.keys(pattern)),
    );
    return found.flat();
  }

  async function resetThrottleCounters() {
    const keys = await throttleKeys();
    if (keys.length) await redis.del(...keys);
  }

  async function cleanup() {
    await prisma.adminUser.deleteMany({
      where: { email: { startsWith: EMAIL_PREFIX } },
    });
    await prisma.ticket.deleteMany({
      where: { subject: { startsWith: SUBJECT_PREFIX } },
    });
    const guests = await prisma.user.findMany({
      where: { deviceId: { startsWith: DEVICE_PREFIX } },
      select: { id: true },
    });
    const ids = guests.map((g) => g.id);
    if (ids.length) {
      await prisma.ticket.deleteMany({ where: { authorUserId: { in: ids } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
  }

  beforeAll(async () => {
    // Лимиты в e2e по умолчанию выключены (см. скрипт `test:e2e`): иначе
    // спеки, честно делающие десятки запросов подряд, упирались бы в них.
    // Этот спек — единственный, кому они нужны, и он включает их себе сам.
    process.env.THROTTLE_ENABLED = 'true';
    app = await createApp(Test.createTestingModule({ imports: [AppModule] }));
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    await cleanup();
  });

  beforeEach(resetThrottleCounters);

  afterAll(async () => {
    await cleanup();
    await resetThrottleCounters();
    await app.close();
    process.env.THROTTLE_ENABLED = 'false';
  });

  async function createStaff(email: string) {
    await prisma.adminUser.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS),
        roles: [AdminRole.SUPPORT_OPERATOR],
        isActive: true,
      },
    });
  }

  it('шестая попытка входа в админку подряд даёт 429, пятая ещё проходит', async () => {
    const email = uniqueEmail('brute');
    await createStaff(email);

    for (let attempt = 1; attempt <= 5; attempt++) {
      await request(app.getHttpServer())
        .post('/v1/admin/auth/login')
        .send({ email, password: 'wrong-password' })
        .expect(401);
    }

    const blocked = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(429);

    // Форма ошибки — общая для проекта, а не своя у троттлера.
    expect(blocked.body).toEqual({
      error: { code: 'RATE_LIMITED', message: expect.any(String) },
    });
  });

  it('лимит входа считается по email: другой сотрудник не заблокирован', async () => {
    const victim = uniqueEmail('victim');
    const other = uniqueEmail('other');
    await createStaff(victim);
    await createStaff(other);

    for (let attempt = 1; attempt <= 6; attempt++) {
      await request(app.getHttpServer())
        .post('/v1/admin/auth/login')
        .send({ email: victim, password: 'wrong-password' });
    }

    // Чужой перебор не должен запирать соседа по офису.
    await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email: other, password: PASSWORD })
      .expect(200);
  });

  it('успешный вход не блокируется предыдущими промахами', async () => {
    const email = uniqueEmail('recover');
    await createStaff(email);

    for (let attempt = 1; attempt <= 4; attempt++) {
      await request(app.getHttpServer())
        .post('/v1/admin/auth/login')
        .send({ email, password: 'wrong-password' })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
  });

  it('одиннадцатая заявка за час даёт 429, десятая проходит', async () => {
    const client = await guestClient(app, `${DEVICE_PREFIX}requests`);

    for (let i = 1; i <= 10; i++) {
      // Тело заведомо невалидное: проверяется лимит, а не создание заявки,
      // и упираться в бизнес-правило «активная заявка уже есть» тут незачем.
      const response = await request(app.getHttpServer())
        .post('/v1/requests')
        .set('Authorization', `Bearer ${client.accessToken}`)
        .send({});
      expect(response.status).not.toBe(429);
    }

    await request(app.getHttpServer())
      .post('/v1/requests')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({})
      .expect(429);
  });

  it('шестой тикет от гостя за час даёт 429', async () => {
    const ticket = {
      category: 'TECHNICAL',
      subject: `${SUBJECT_PREFIX}не открывается приложение`,
      body: 'Экран остаётся белым после запуска, перезагрузка не помогает.',
      contactPhone: '+77015550000',
    };

    for (let i = 1; i <= 5; i++) {
      await request(app.getHttpServer())
        .post('/v1/tickets')
        .send(ticket)
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/v1/tickets')
      .send(ticket)
      .expect(429);
  });

  it('счётчики лежат в Redis, а не в памяти процесса', async () => {
    // Иначе при двух репликах пользователь получает вдвое больший лимит,
    // а рестарт обнуляет счётчик — лимит перестаёт быть лимитом.
    const email = uniqueEmail('redis');
    await createStaff(email);

    await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);

    const keys = await throttleKeys();
    expect(keys.length).toBeGreaterThan(0);
  });
});
