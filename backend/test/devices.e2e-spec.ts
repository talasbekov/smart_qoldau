import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { registeredUser } from './utils/expert-helpers';

// Номера спека задачи 2 (E9, устройства), не пересекаются с другими спеками.
const PH_U1 = '+77093000001';
const PH_U2 = '+77093000002';
const ALL_PHONES = [PH_U1, PH_U2];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    lastCode = match ? match[1] : '';
  }
}

let app: INestApplication;

function authed(
  method: 'post' | 'delete' | 'patch',
  token: string,
  url: string,
) {
  return request(app.getHttpServer())
    [method](url)
    .set('Authorization', `Bearer ${token}`);
}

describe('Регистрация устройств и локаль (E9, задача 2)', () => {
  let prisma: PrismaService;

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.device.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
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

  it('регистрация устройства -> запись в БД; тот же token от ДРУГОГО юзера -> перепривязка, не дубль', async () => {
    const u1 = await login(PH_U1);
    const u2 = await login(PH_U2);

    const res = await authed('post', u1.accessToken, '/v1/devices')
      .send({ platform: 'android', token: 'fcm-dev-1' })
      .expect(201);
    expect(res.body).toMatchObject({ platform: 'android', token: 'fcm-dev-1' });

    // Телефон сменил владельца аккаунта — токен переехал к u2.
    await authed('post', u2.accessToken, '/v1/devices')
      .send({ platform: 'android', token: 'fcm-dev-1' })
      .expect(201);

    const devices = await prisma.device.findMany({
      where: { token: 'fcm-dev-1' },
    });
    expect(devices).toHaveLength(1);
    expect(devices[0].userId).toBe(u2.user.id);
  });

  it('locale при регистрации устройства обновляет User.locale; PATCH /v1/me/locale тоже; невалидная -> 400', async () => {
    const u1 = await login(PH_U1);

    await authed('post', u1.accessToken, '/v1/devices')
      .send({ platform: 'ios', token: 'apns-dev-2', locale: 'kz' })
      .expect(201);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: u1.user.id } }))
        .locale,
    ).toBe('kz');

    await authed('patch', u1.accessToken, '/v1/me/locale')
      .send({ locale: 'ru' })
      .expect(200);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: u1.user.id } }))
        .locale,
    ).toBe('ru');

    await authed('patch', u1.accessToken, '/v1/me/locale')
      .send({ locale: 'en' })
      .expect(400);
  });

  it('удаление: свой token -> 204 и исчез; чужой/несуществующий -> 404 DEVICE_NOT_FOUND; без JWT -> 401', async () => {
    const u1 = await login(PH_U1);
    const u2 = await login(PH_U2);

    await authed('post', u1.accessToken, '/v1/devices')
      .send({ platform: 'android', token: 'fcm-dev-3' })
      .expect(201);

    // Токен уходит ТЕЛОМ (E11a, задача 9): в пути он попадал бы в
    // access-логи nginx, трейсы APM и историю прокси.
    const foreign = await authed('delete', u2.accessToken, '/v1/devices')
      .send({ token: 'fcm-dev-3' })
      .expect(404);
    expect(foreign.body.error.code).toBe('DEVICE_NOT_FOUND');

    await authed('delete', u1.accessToken, '/v1/devices')
      .send({ token: 'fcm-dev-3' })
      .expect(204);
    expect(await prisma.device.count({ where: { token: 'fcm-dev-3' } })).toBe(
      0,
    );

    await authed('delete', u1.accessToken, '/v1/devices')
      .send({ token: 'fcm-dev-3' })
      .expect(404);

    // Старого маршрута с токеном в пути больше нет — именно нет, а не
    // «оставлен для совместимости»: два пути к одному действию это дыра,
    // про которую забудут.
    await authed('delete', u1.accessToken, '/v1/devices/fcm-dev-3').expect(404);

    await request(app.getHttpServer())
      .post('/v1/devices')
      .send({ platform: 'android', token: 'x' })
      .expect(401);
  });
});
