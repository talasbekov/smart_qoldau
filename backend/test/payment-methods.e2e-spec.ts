import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { clientUser, guestClient } from './utils/client-helpers';

// Номера/deviceId спека задачи 3 (E5, Платёжный контур), не пересекаются с
// другими спеками.
const PHONE_CLIENT = '+77085000001';
const PHONE_OTHER = '+77085000002';
const ALL_PHONES = [PHONE_CLIENT, PHONE_OTHER];
const GUEST_DEVICE = 'payment-methods-guest-dev-1';

const VISA_PAN = '4111111111111111';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    lastCode = match ? match[1] : '';
  }
}

function codeGetter() {
  return lastCode;
}

describe('Payment methods (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { phone: { in: ALL_PHONES } },
          { deviceId: GUEST_DEVICE, isGuest: true },
        ],
      },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.paymentMethod.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    const keys = await redis.keys('mockpay:*');
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
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  beforeEach(async () => {
    await cleanup();
  });

  describe('POST /v1/payment-methods', () => {
    it('привязывает карту: maskedPan **** 1111, PAN отсутствует в БД', async () => {
      const { accessToken } = await clientUser(app, PHONE_CLIENT, codeGetter);

      const res = await request(app.getHttpServer())
        .post('/v1/payment-methods')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pan: VISA_PAN, expiry: '12/28', holderName: 'Ivan Petrov' })
        .expect(201);

      expect(res.body.maskedPan).toBe('**** 1111');
      expect(res.body.brand).toBe('visa');
      expect(res.body.holderName).toBe('Ivan Petrov');
      expect(res.body).toHaveProperty('id');
      expect(res.body).not.toHaveProperty('providerToken');
      expect(res.body).not.toHaveProperty('pan');

      // Raw-чтение записи из БД — PAN нигде не должен встречаться.
      const raw = await prisma.paymentMethod.findUnique({
        where: { id: res.body.id },
      });
      const rawJson = JSON.stringify(raw);
      expect(rawJson).not.toContain(VISA_PAN);
      expect(rawJson.includes(VISA_PAN)).toBe(false);
    });

    it('гостевой клиент может привязать карту (оплата до конверсии)', async () => {
      const { accessToken } = await guestClient(app, GUEST_DEVICE);

      await request(app.getHttpServer())
        .post('/v1/payment-methods')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pan: VISA_PAN, expiry: '12/28', holderName: 'Ivan Petrov' })
        .expect(201);
    });

    it('без JWT -> 401', async () => {
      await request(app.getHttpServer())
        .post('/v1/payment-methods')
        .send({ pan: VISA_PAN, expiry: '12/28', holderName: 'Ivan Petrov' })
        .expect(401);
    });

    it('невалидный PAN -> 400', async () => {
      const { accessToken } = await clientUser(app, PHONE_CLIENT, codeGetter);

      await request(app.getHttpServer())
        .post('/v1/payment-methods')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pan: 'abc', expiry: '12/28', holderName: 'Ivan Petrov' })
        .expect(400);
    });
  });

  describe('GET /v1/payment-methods', () => {
    it('возвращает список своих живых карт', async () => {
      const { accessToken } = await clientUser(app, PHONE_CLIENT, codeGetter);

      await request(app.getHttpServer())
        .post('/v1/payment-methods')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pan: VISA_PAN, expiry: '12/28', holderName: 'Ivan Petrov' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/v1/payment-methods')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].maskedPan).toBe('**** 1111');
    });

    it('пустой список, если карт нет', async () => {
      const { accessToken } = await clientUser(app, PHONE_CLIENT, codeGetter);

      const res = await request(app.getHttpServer())
        .get('/v1/payment-methods')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('не показывает чужие карты', async () => {
      const { accessToken: tokenA } = await clientUser(
        app,
        PHONE_CLIENT,
        codeGetter,
      );
      await request(app.getHttpServer())
        .post('/v1/payment-methods')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pan: VISA_PAN, expiry: '12/28', holderName: 'Ivan Petrov' })
        .expect(201);

      const { accessToken: tokenB } = await clientUser(
        app,
        PHONE_OTHER,
        codeGetter,
      );
      const res = await request(app.getHttpServer())
        .get('/v1/payment-methods')
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('DELETE /v1/payment-methods/:id', () => {
    it('удаляет карту (soft-delete) - исчезает из списка', async () => {
      const { accessToken } = await clientUser(app, PHONE_CLIENT, codeGetter);

      const created = await request(app.getHttpServer())
        .post('/v1/payment-methods')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pan: VISA_PAN, expiry: '12/28', holderName: 'Ivan Petrov' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/v1/payment-methods/${created.body.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .get('/v1/payment-methods')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toEqual([]);

      // Запись остаётся в БД как soft-deleted (история платежей ссылается).
      const raw = await prisma.paymentMethod.findUnique({
        where: { id: created.body.id },
      });
      expect(raw?.deletedAt).not.toBeNull();
    });

    it('чужая карта -> 404 PAYMENT_METHOD_NOT_FOUND', async () => {
      const { accessToken: tokenA } = await clientUser(
        app,
        PHONE_CLIENT,
        codeGetter,
      );
      const created = await request(app.getHttpServer())
        .post('/v1/payment-methods')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ pan: VISA_PAN, expiry: '12/28', holderName: 'Ivan Petrov' })
        .expect(201);

      const { accessToken: tokenB } = await clientUser(
        app,
        PHONE_OTHER,
        codeGetter,
      );
      await request(app.getHttpServer())
        .delete(`/v1/payment-methods/${created.body.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404)
        .then((res) => {
          expect(res.body.error.code).toBe('PAYMENT_METHOD_NOT_FOUND');
        });
    });

    it('несуществующая карта -> 404 PAYMENT_METHOD_NOT_FOUND', async () => {
      const { accessToken } = await clientUser(app, PHONE_CLIENT, codeGetter);

      await request(app.getHttpServer())
        .delete('/v1/payment-methods/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404)
        .then((res) => {
          expect(res.body.error.code).toBe('PAYMENT_METHOD_NOT_FOUND');
        });
    });

    it('невалидный UUID -> 400', async () => {
      const { accessToken } = await clientUser(app, PHONE_CLIENT, codeGetter);

      await request(app.getHttpServer())
        .delete('/v1/payment-methods/not-a-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('без JWT -> 401', async () => {
      await request(app.getHttpServer())
        .delete('/v1/payment-methods/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });
  });
});
