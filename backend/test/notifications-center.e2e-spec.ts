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

// Номера спека задачи 4 (E9, центр уведомлений), не пересекаются с другими.
const PH_U1 = '+77095000001';
const PH_U2 = '+77095000002';
const ALL_PHONES = [PH_U1, PH_U2];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

let app: INestApplication;

function get(token: string, url: string) {
  return request(app.getHttpServer())
    .get(url)
    .set('Authorization', `Bearer ${token}`);
}
function post(token: string, url: string) {
  return request(app.getHttpServer())
    .post(url)
    .set('Authorization', `Bearer ${token}`);
}

describe('In-app центр уведомлений (E9, задача 4)', () => {
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

  it('список с пагинацией (новые сверху) и unreadCount; чужие уведомления не видны', async () => {
    const u1 = await login(PH_U1);
    const u2 = await login(PH_U2);

    await notifications.dispatch(u1.user.id, 'earning.credited', {
      amountTenge: '5 000',
    });
    await notifications.dispatch(u1.user.id, 'chat.message', {});
    await notifications.dispatch(u1.user.id, 'payout.rejected', {
      reason: 'x',
    });
    await notifications.dispatch(u2.user.id, 'chat.message', {});

    const page1 = await get(u1.accessToken, '/v1/notifications?take=2').expect(
      200,
    );
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.unreadCount).toBe(3);
    expect(page1.body.items[0].type).toBe('payout.rejected');
    expect(page1.body.items[0].readAt).toBeNull();

    const page2 = await get(
      u1.accessToken,
      '/v1/notifications?take=2&skip=2',
    ).expect(200);
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.items[0].type).toBe('earning.credited');
  });

  it('read выбранных -> readAt и unreadCount падает; read-all без ids; повторный read идемпотентен', async () => {
    const u1 = await login(PH_U1);
    await notifications.dispatch(u1.user.id, 'chat.message', {});
    await notifications.dispatch(u1.user.id, 'chat.message', {});
    await notifications.dispatch(u1.user.id, 'chat.message', {});

    const list = await get(u1.accessToken, '/v1/notifications').expect(200);
    const [first, second] = list.body.items;

    await post(u1.accessToken, '/v1/notifications/read')
      .send({ ids: [first.id] })
      .expect(200);
    const afterOne = await get(u1.accessToken, '/v1/notifications').expect(200);
    expect(afterOne.body.unreadCount).toBe(2);
    expect(
      afterOne.body.items.find((n: any) => n.id === first.id).readAt,
    ).not.toBeNull();
    expect(
      afterOne.body.items.find((n: any) => n.id === second.id).readAt,
    ).toBeNull();

    // read-all + идемпотентность повторного read.
    await post(u1.accessToken, '/v1/notifications/read').send({}).expect(200);
    await post(u1.accessToken, '/v1/notifications/read')
      .send({ ids: [first.id] })
      .expect(200);
    const afterAll = await get(u1.accessToken, '/v1/notifications').expect(200);
    expect(afterAll.body.unreadCount).toBe(0);
  });

  it('ack: pushDeliveredAt проставляется один раз (повтор не сдвигает); чужое уведомление -> 404', async () => {
    const u1 = await login(PH_U1);
    const u2 = await login(PH_U2);
    await notifications.dispatch(u1.user.id, 'offer.incoming', {});

    const stored = await prisma.notification.findFirstOrThrow({
      where: { userId: u1.user.id },
    });

    await post(u1.accessToken, `/v1/notifications/${stored.id}/ack`).expect(
      200,
    );
    const acked = await prisma.notification.findUniqueOrThrow({
      where: { id: stored.id },
    });
    expect(acked.pushDeliveredAt).not.toBeNull();

    // Повторный ack не сдвигает отметку (метрика доставки — первый ack).
    await post(u1.accessToken, `/v1/notifications/${stored.id}/ack`).expect(
      200,
    );
    const reAcked = await prisma.notification.findUniqueOrThrow({
      where: { id: stored.id },
    });
    expect(reAcked.pushDeliveredAt!.getTime()).toBe(
      acked.pushDeliveredAt!.getTime(),
    );

    const foreign = await post(
      u2.accessToken,
      `/v1/notifications/${stored.id}/ack`,
    ).expect(404);
    expect(foreign.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
  });
});
