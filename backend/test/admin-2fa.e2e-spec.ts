import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { AdminTotpService } from '../src/admin/admin-totp.service';
import { authenticator } from 'otplib';
import { createApp } from './utils/create-app';

// Второй фактор сотрудников (E11a, задача 5).
const EMAIL_PREFIX = 'admin-2fa-e2e-';
const PASSWORD = 'correct-horse-battery-staple';
const BCRYPT_ROUNDS = 10;

// Код СЛЕДУЮЩЕГО 30-секундного окна. Нужен потому, что одноразовость
// (E11a, задача 5) гасит уже использованный код: в тесте привязка и вход
// происходят в одну секунду, и код текущего окна во втором шаге был бы
// законно отвергнут как повтор. Проверка допускает окно ±1 шаг, поэтому
// код следующего окна принимается прямо сейчас — и он другой.
function nextWindowCode(secret: string): string {
  // Именно clone(), а не подмена authenticator.options: присваивание
  // options МЕРЖИТСЯ в глобальный экземпляр, и заданный `epoch` остаётся
  // в нём навсегда — следующие коды считались бы для застывшего времени
  // (поймано двумя падающими тестами подряд).
  return authenticator.clone({ epoch: Date.now() + 30_000 }).generate(secret);
}

let seq = 0;
const uniqueEmail = (tag: string) =>
  `${EMAIL_PREFIX}${tag}-${Date.now()}-${seq++}@smartqoldau.kz`;

describe('Двухфакторная аутентификация сотрудников (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let totp: AdminTotpService;

  async function cleanup() {
    await prisma.adminUser.deleteMany({
      where: { email: { startsWith: EMAIL_PREFIX } },
    });
    const keys = await redis.keys('admin:*');
    if (keys.length) await redis.del(...keys);
  }

  async function createStaff(email: string) {
    return prisma.adminUser.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS),
        roles: [AdminRole.SUPPORT_OPERATOR],
        isActive: true,
      },
    });
  }

  const loginRequest = (email: string) =>
    request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email, password: PASSWORD });

  /// Полный путь привязки: setup -> confirm. Возвращает секрет и коды
  /// восстановления — как их видит сотрудник ровно один раз.
  async function enableTotp(email: string) {
    const login = await loginRequest(email).expect(200);
    const setup = await request(app.getHttpServer())
      .post('/v1/admin/auth/totp/setup')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/admin/auth/totp/confirm')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ code: totp.generateCode(setup.body.secret) })
      .expect(204);

    return setup.body as {
      secret: string;
      otpauthUrl: string;
      recoveryCodes: string[];
    };
  }

  beforeAll(async () => {
    app = await createApp(Test.createTestingModule({ imports: [AppModule] }));
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    totp = app.get(AdminTotpService);
    await cleanup();
  });

  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('вход при включённой 2FA не выдаёт токены без второго фактора', async () => {
    const email = uniqueEmail('login');
    await createStaff(email);
    await enableTotp(email);

    const res = await loginRequest(email).expect(200);

    expect(res.body.totpRequired).toBe(true);
    expect(res.body.challengeToken).toEqual(expect.any(String));
    expect(res.body.accessToken).toBeUndefined();

    // challengeToken не открывает ни один рабочий эндпоинт.
    await request(app.getHttpServer())
      .get('/v1/admin/tickets')
      .set('Authorization', `Bearer ${res.body.challengeToken}`)
      .expect(401);
  });

  it('верный код выдаёт пару токенов, неверный — 401 и audit', async () => {
    const email = uniqueEmail('verify');
    const staff = await createStaff(email);
    const setup = await enableTotp(email);

    const challenge = await loginRequest(email).expect(200);

    await request(app.getHttpServer())
      .post('/v1/admin/auth/totp/verify')
      .send({ challengeToken: challenge.body.challengeToken, code: '000000' })
      .expect(401);

    const failed = await prisma.auditLog.findFirst({
      where: { entityId: staff.id, transition: 'admin.totp_failed' },
    });
    expect(failed).not.toBeNull();

    const ok = await request(app.getHttpServer())
      .post('/v1/admin/auth/totp/verify')
      .send({
        challengeToken: challenge.body.challengeToken,
        code: nextWindowCode(setup.secret),
      })
      .expect(200);

    expect(ok.body.accessToken).toEqual(expect.any(String));
    await request(app.getHttpServer())
      .get('/v1/admin/tickets')
      .set('Authorization', `Bearer ${ok.body.accessToken}`)
      .expect(200);
  });

  it('код восстановления срабатывает один раз', async () => {
    const email = uniqueEmail('recovery');
    await createStaff(email);
    const setup = await enableTotp(email);
    const [recoveryCode] = setup.recoveryCodes;

    const first = await loginRequest(email).expect(200);
    await request(app.getHttpServer())
      .post('/v1/admin/auth/totp/verify')
      .send({ challengeToken: first.body.challengeToken, code: recoveryCode })
      .expect(200);

    const second = await loginRequest(email).expect(200);
    await request(app.getHttpServer())
      .post('/v1/admin/auth/totp/verify')
      .send({ challengeToken: second.body.challengeToken, code: recoveryCode })
      .expect(401);
  });

  it('повторная привязка после включения отклоняется', async () => {
    const email = uniqueEmail('already');
    await createStaff(email);
    const setupInfo = await enableTotp(email);

    const challenge = await loginRequest(email).expect(200);
    const session = await request(app.getHttpServer())
      .post('/v1/admin/auth/totp/verify')
      .send({
        challengeToken: challenge.body.challengeToken,
        code: nextWindowCode(setupInfo.secret),
      })
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/admin/auth/totp/setup')
      .set('Authorization', `Bearer ${session.body.accessToken}`)
      .expect(409);
  });

  it('секрет не появляется ни в одном ответе, кроме setup', async () => {
    const email = uniqueEmail('secrecy');
    await createStaff(email);
    const setup = await enableTotp(email);

    const challenge = await loginRequest(email).expect(200);
    const session = await request(app.getHttpServer())
      .post('/v1/admin/auth/totp/verify')
      .send({
        challengeToken: challenge.body.challengeToken,
        code: nextWindowCode(setup.secret),
      })
      .expect(200);
    const staffList = await request(app.getHttpServer())
      .get('/v1/admin/tickets')
      .set('Authorization', `Bearer ${session.body.accessToken}`)
      .expect(200);

    for (const body of [challenge.body, session.body, staffList.body]) {
      expect(JSON.stringify(body)).not.toContain(setup.secret);
    }
  });

  it('при TOTP_REQUIRED=true сотрудник без 2FA видит только привязку', async () => {
    // Иначе включение требования второго фактора запирало бы всех разом:
    // рабочие маршруты закрыты, а привязать 2FA тоже нельзя.
    const email = uniqueEmail('required');
    await createStaff(email);
    const session = await loginRequest(email).expect(200);

    process.env.TOTP_REQUIRED = 'true';
    try {
      await request(app.getHttpServer())
        .get('/v1/admin/tickets')
        .set('Authorization', `Bearer ${session.body.accessToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .post('/v1/admin/auth/totp/setup')
        .set('Authorization', `Bearer ${session.body.accessToken}`)
        .expect(200);
    } finally {
      process.env.TOTP_REQUIRED = 'false';
    }
  });

  it('без второго фактора нельзя обойтись, зная только пароль', async () => {
    // challengeToken выдаётся любому, кто знает пароль, — но сам по себе он
    // бесполезен: пара токенов без кода не выдаётся.
    const email = uniqueEmail('bypass');
    await createStaff(email);
    await enableTotp(email);

    const challenge = await loginRequest(email).expect(200);

    await request(app.getHttpServer())
      .post('/v1/admin/auth/refresh')
      .send({ refreshToken: challenge.body.challengeToken })
      .expect(401);
  });
});
