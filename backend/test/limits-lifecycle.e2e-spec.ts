import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { AdminTotpService } from '../src/admin/admin-totp.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { RetentionSweepService } from '../src/maintenance/retention-sweep.service';
import { SmsBudgetService } from '../src/notifications/sms-budget.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { clientUser as clientUserHelper } from './utils/client-helpers';
import { flushPushOutbox } from './utils/outbox-helpers';

// Сквозной прогон эпика E11a (задача 11): все закрытые дыры проверяются
// одним сценарием, чтобы поймать их взаимные конфликты.
const PH_CLIENT = '+77099400001';
const EMAIL_PREFIX = 'limits-lifecycle-e2e-';
const SUBJECT_PREFIX = 'limits-lifecycle-e2e ';
const PASSWORD = 'correct-horse-battery-staple';
const BCRYPT_ROUNDS = 10;

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    if (match) lastCode = match[1];
  }
}

/// Код следующего окна: одноразовость гасит уже использованный код.
const nextWindowCode = (secret: string) =>
  authenticator.clone({ epoch: Date.now() + 30_000 }).generate(secret);

describe('Сквозной прогон лимитов и долгов (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let totp: AdminTotpService;
  let notifications: NotificationsService;
  let retention: RetentionSweepService;
  let smsBudget: SmsBudgetService;

  async function cleanup() {
    await prisma.ticketMessage.deleteMany({
      where: { ticket: { subject: { startsWith: SUBJECT_PREFIX } } },
    });
    await prisma.ticket.deleteMany({
      where: { subject: { startsWith: SUBJECT_PREFIX } },
    });
    await prisma.adminUser.deleteMany({
      where: { email: { startsWith: EMAIL_PREFIX } },
    });
    const users = await prisma.user.findMany({
      where: { phone: PH_CLIENT },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (ids.length) {
      await prisma.notificationOutbox.deleteMany({
        where: { userId: { in: ids } },
      });
      await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
      await prisma.device.deleteMany({ where: { userId: { in: ids } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.smsCode.deleteMany({ where: { phone: PH_CLIENT } });
    const keys = [
      ...(await redis.keys('admin:*')),
      ...(await redis.keys('{*}:hits')),
      ...(await redis.keys('{*}:blocked')),
      ...(await redis.keys('mockpush:*')),
      ...(await redis.keys('sms:cooldown:limits-lifecycle-*')),
    ];
    if (keys.length) await redis.del(...keys);
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    totp = app.get(AdminTotpService);
    notifications = app.get(NotificationsService);
    retention = app.get(RetentionSweepService);
    smsBudget = app.get(SmsBudgetService);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    process.env.THROTTLE_ENABLED = 'false';
    await app.close();
  });

  it('лимиты, второй фактор, отзыв доступа, очередь пушей, тикеты и уборка работают вместе', async () => {
    // --- 1. Перебор пароля админки упирается в лимит ---
    process.env.THROTTLE_ENABLED = 'true';
    const bossEmail = `${EMAIL_PREFIX}boss@smartqoldau.kz`;
    const boss = await prisma.adminUser.create({
      data: {
        email: bossEmail,
        passwordHash: await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS),
        roles: [AdminRole.SUPERADMIN],
        isActive: true,
      },
    });

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/v1/admin/auth/login')
        .send({ email: bossEmail, password: 'wrong' })
        .expect(401);
    }
    const throttled = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email: bossEmail, password: 'wrong' })
      .expect(429);
    expect(throttled.body.error.code).toBe('RATE_LIMITED');
    process.env.THROTTLE_ENABLED = 'false';

    // --- 2. Сотрудник с 2FA входит в два шага ---
    const staffEmail = `${EMAIL_PREFIX}staff@smartqoldau.kz`;
    const staff = await prisma.adminUser.create({
      data: {
        email: staffEmail,
        passwordHash: await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS),
        roles: [AdminRole.SUPPORT_OPERATOR],
        isActive: true,
      },
    });

    const firstLogin = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email: staffEmail, password: PASSWORD })
      .expect(200);
    const setup = await request(app.getHttpServer())
      .post('/v1/admin/auth/totp/setup')
      .set('Authorization', `Bearer ${firstLogin.body.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/v1/admin/auth/totp/confirm')
      .set('Authorization', `Bearer ${firstLogin.body.accessToken}`)
      .send({ code: totp.generateCode(setup.body.secret) })
      .expect(204);

    const challenge = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email: staffEmail, password: PASSWORD })
      .expect(200);
    expect(challenge.body.totpRequired).toBe(true);
    const session = await request(app.getHttpServer())
      .post('/v1/admin/auth/totp/verify')
      .send({
        challengeToken: challenge.body.challengeToken,
        code: nextWindowCode(setup.body.secret),
      })
      .expect(200);

    // --- 3. Клиент открывает обращение, сотрудник отвечает, автор дописывает ---
    const client = await clientUserHelper(app, PH_CLIENT, () => lastCode);
    const ticket = await request(app.getHttpServer())
      .post('/v1/tickets')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({
        category: 'TECHNICAL',
        subject: `${SUBJECT_PREFIX}сквозной`,
        body: 'Видео не открывается на Android 13, звук при этом идёт.',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/admin/tickets/${ticket.body.id}/reply`)
      .set('Authorization', `Bearer ${session.body.accessToken}`)
      .send({ body: 'Приняли в работу, уточним детали.' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/tickets/${ticket.body.id}/reply`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({ body: 'Добавлю: началось после обновления приложения.' })
      .expect(204);

    // Первый ответ сотрудника назначил тикет ему.
    const assigned = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.body.id },
    });
    expect(assigned.assignedToId).toBe(staff.id);

    // --- 4. Уведомление доходит через очередь, а не из пути запроса ---
    await request(app.getHttpServer())
      .post('/v1/devices')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({ platform: 'android', token: 'limits-lifecycle-token' })
      .expect(201);
    await notifications.dispatch(client.userId, 'earning.credited', {
      amountTenge: '1 000',
      amountTiyn: 100_000,
    });
    expect(
      await redis.lrange('mockpush:sent:limits-lifecycle-token', 0, -1),
    ).toEqual([]);
    await flushPushOutbox(app);
    const sent = (
      await redis.lrange('mockpush:sent:limits-lifecycle-token', 0, -1)
    ).map((raw) => JSON.parse(raw).data.type);
    // Ответ сотрудника в тикет тоже ставится в очередь, поэтому здесь два пуша.
    expect(sent).toEqual(
      expect.arrayContaining(['earning.credited', 'ticket.replied']),
    );

    // --- 5. Клиент упирается в лимит заявок, а SMS-бюджет гасит веер ---
    process.env.THROTTLE_ENABLED = 'true';
    for (let i = 1; i <= 10; i++) {
      // Тело заведомо невалидное: проверяется лимит, а не создание заявки.
      const attempt = await request(app.getHttpServer())
        .post('/v1/requests')
        .set('Authorization', `Bearer ${client.accessToken}`)
        .send({});
      expect(attempt.status).not.toBe(429);
    }
    await request(app.getHttpServer())
      .post('/v1/requests')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({})
      .expect(429);
    process.env.THROTTLE_ENABLED = 'false';

    const budgetExpertId = 'limits-lifecycle-expert';
    expect(await smsBudget.explainConsume(budgetExpertId)).toEqual({
      allowed: true,
    });
    expect(await smsBudget.explainConsume(budgetExpertId)).toEqual({
      allowed: false,
      limit: 'cooldown',
    });

    // --- 6. Каталог отдаётся страницами ---
    const catalog = await request(app.getHttpServer())
      .get('/v1/experts?take=5')
      .expect(200);
    expect(catalog.body.length).toBeLessThanOrEqual(5);
    await request(app.getHttpServer()).get('/v1/experts?take=101').expect(400);

    // --- 7. Суперадмин деактивирует сотрудника: доступ пропадает сразу ---
    // Сначала фиксируем, что тот же токен работал: иначе 401 ниже был бы
    // неотличим от любой другой ошибки авторизации.
    await request(app.getHttpServer())
      .get('/v1/admin/tickets')
      .set('Authorization', `Bearer ${session.body.accessToken}`)
      .expect(200);
    const bossSession = await request(app.getHttpServer())
      .post('/v1/admin/auth/login')
      .send({ email: bossEmail, password: PASSWORD })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/v1/admin/staff/${staff.id}`)
      .set('Authorization', `Bearer ${bossSession.body.accessToken}`)
      .send({ isActive: false })
      .expect(200);
    await request(app.getHttpServer())
      .get('/v1/admin/tickets')
      .set('Authorization', `Bearer ${session.body.accessToken}`)
      .expect(401);

    // --- 8. Последнего суперадмина деактивировать нельзя ---
    await request(app.getHttpServer())
      .patch(`/v1/admin/staff/${boss.id}`)
      .set('Authorization', `Bearer ${bossSession.body.accessToken}`)
      .send({ isActive: false })
      .expect(400);

    // --- 9. Уборка не трогает непрочитанное ---
    const unread = await prisma.notification.create({
      data: {
        userId: client.userId,
        type: 'earning.credited',
        title: 'Старое непрочитанное',
        body: 'Не должно быть удалено',
        data: {},
        createdAt: new Date(Date.now() - 400 * 24 * 3600_000),
      },
    });
    await retention.sweep();
    expect(
      await prisma.notification.findUnique({ where: { id: unread.id } }),
    ).not.toBeNull();
  });
});
