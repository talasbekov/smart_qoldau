import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { NotificationsService } from '../src/notifications/notifications.service';
import { createApp } from './utils/create-app';
import { registeredUser } from './utils/expert-helpers';

// Номера спека задачи 3 (E9, dispatch), не пересекаются с другими спеками.
const PH_U1 = '+77094000001';
const PH_U2 = '+77094000002';
const ALL_PHONES = [PH_U1, PH_U2];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

let app: INestApplication;

describe('Шина уведомлений: dispatch (E9, задача 3)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  let notifications: NotificationsService;

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.notification.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.device.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
    await prisma.auditLog.deleteMany({ where: { entityId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

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
  });

  beforeEach(() => cleanup());

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function login(phone: string) {
    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone })
      .expect(204);
    return registeredUser(app, phone, lastCode);
  }

  async function addDevice(
    accessToken: string,
    token: string,
    locale?: string,
  ) {
    await request(app.getHttpServer())
      .post('/v1/devices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ platform: 'android', token, ...(locale ? { locale } : {}) })
      .expect(201);
  }

  it('dispatch юзеру с 2 устройствами: Notification со снапшотом текста, push на оба, pushSentAt, notificationId в data пуша', async () => {
    const u = await login(PH_U1);
    await addDevice(u.accessToken, 'disp-tok-1');
    await addDevice(u.accessToken, 'disp-tok-2');

    await notifications.dispatch(u.user.id, 'earning.credited', {
      amountTenge: '12 750',
      amountTiyn: 1_275_000,
    });

    const stored = await prisma.notification.findMany({
      where: { userId: u.user.id },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0].type).toBe('earning.credited');
    expect(stored[0].title).toBe('Начисление');
    expect(stored[0].body).toContain('12 750');
    expect(stored[0].pushSentAt).not.toBeNull();

    for (const token of ['disp-tok-1', 'disp-tok-2']) {
      const sent = await redis.lrange(`mockpush:sent:${token}`, 0, -1);
      expect(sent).toHaveLength(1);
      const record = JSON.parse(sent[0]);
      expect(record.title).toBe('Начисление');
      expect(record.critical).toBe(false);
      // ack доставки идёт по notificationId — он обязан быть в data пуша.
      expect(record.data.notificationId).toBe(stored[0].id);
    }
  });

  it('получатель с locale kz получает kz-текст', async () => {
    const u = await login(PH_U2);
    await addDevice(u.accessToken, 'disp-tok-kz', 'kz');

    await notifications.dispatch(u.user.id, 'offer.incoming', {
      offerId: 'off-1',
    });

    const stored = await prisma.notification.findFirstOrThrow({
      where: { userId: u.user.id },
    });
    expect(stored.title).toBe('Жаңа өтінім');

    const sent = await redis.lrange('mockpush:sent:disp-tok-kz', 0, -1);
    expect(JSON.parse(sent[0])).toMatchObject({
      title: 'Жаңа өтінім',
      critical: true,
    });
  });

  it('сбой push-провайдера не роняет dispatch: запись создана, pushSentAt null', async () => {
    const u = await login(PH_U1);
    await addDevice(u.accessToken, 'disp-tok-broken');
    await redis.set('mockpush:fail:disp-tok-broken', '1');

    await expect(
      notifications.dispatch(u.user.id, 'chat.message', {
        consultationId: 'c-1',
      }),
    ).resolves.toBeUndefined();

    const stored = await prisma.notification.findFirstOrThrow({
      where: { userId: u.user.id },
    });
    expect(stored.pushSentAt).toBeNull();
    expect(
      await redis.lrange('mockpush:sent:disp-tok-broken', 0, -1),
    ).toHaveLength(0);
  });
});
