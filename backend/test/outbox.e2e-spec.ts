import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { createApp } from './utils/create-app';
import { clientUser as clientUserHelper } from './utils/client-helpers';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { flushPushOutbox } from './utils/outbox-helpers';

// Очередь пушей (E11a, задача 3): путь запроса ставит строку и не ждёт
// сетевых вызовов; отправкой занимается sweep.
const PH_U1 = '+77098000001';
const ALL_PHONES = [PH_U1];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    if (match) lastCode = match[1];
  }
}

describe('Очередь отправки пушей (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let notifications: NotificationsService;

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    if (userIds.length) {
      await prisma.notificationOutbox.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.notification.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.device.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
    const keys = await redis.keys('mockpush:*');
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
    notifications = app.get(NotificationsService);
    await cleanup();
  });

  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('dispatch не шлёт пуш сам: ставит запись в очередь', async () => {
    const user = await clientUserHelper(app, PH_U1, () => lastCode);
    await request(app.getHttpServer())
      .post('/v1/devices')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ platform: 'android', token: 'outbox-tok-1' })
      .expect(201);

    await notifications.dispatch(user.userId, 'earning.credited', {
      amountTenge: '3 392',
      amountTiyn: 339_150,
    });

    // До тика провайдер не тронут — это и есть «веер снят с пути запроса».
    expect(await redis.lrange('mockpush:sent:outbox-tok-1', 0, -1)).toEqual([]);
    const queued = await prisma.notificationOutbox.findMany({
      where: { userId: user.userId },
    });
    expect(queued).toHaveLength(1);
    expect(queued[0].sentAt).toBeNull();

    await flushPushOutbox(app);

    const sent = await redis.lrange('mockpush:sent:outbox-tok-1', 0, -1);
    expect(sent).toHaveLength(1);
    const settled = await prisma.notificationOutbox.findFirstOrThrow({
      where: { userId: user.userId },
    });
    expect(settled.sentAt).not.toBeNull();
  });

  it('повторный тик не отправляет то же уведомление дважды', async () => {
    const user = await clientUserHelper(app, PH_U1, () => lastCode);
    await request(app.getHttpServer())
      .post('/v1/devices')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ platform: 'android', token: 'outbox-tok-2' })
      .expect(201);

    await notifications.dispatch(user.userId, 'earning.credited', {
      amountTenge: '1 000',
      amountTiyn: 100_000,
    });

    await flushPushOutbox(app);
    await flushPushOutbox(app);

    expect(
      await redis.lrange('mockpush:sent:outbox-tok-2', 0, -1),
    ).toHaveLength(1);
  });

  it('получатель без устройств не копит записи в очереди', async () => {
    // Клиент может не регистрировать токен (пуши выключены) — очередь не
    // должна расти вечно из-за этого.
    const user = await clientUserHelper(app, PH_U1, () => lastCode);

    await notifications.dispatch(user.userId, 'earning.credited', {
      amountTenge: '1 000',
      amountTiyn: 100_000,
    });
    await flushPushOutbox(app);

    const row = await prisma.notificationOutbox.findFirstOrThrow({
      where: { userId: user.userId },
    });
    expect(row.sentAt).not.toBeNull();
    expect(row.deadAt).toBeNull();
  });
});
