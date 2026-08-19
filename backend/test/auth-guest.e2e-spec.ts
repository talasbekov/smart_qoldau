import { Test } from '@nestjs/testing';
import { HttpException, INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/common/filters/app-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';

// Отдельные номера/deviceId спека задачи 7, не пересекаются с другими спеками.
const PHONE2 = '+77022222222';
const PHONE3 = '+77033333333';
const DEVICE_1 = 'dev-1';
const DEVICE_2 = 'dev-2';
const DEVICE_3 = 'dev-3';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

describe('Auth guest / convert (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { phone: { in: [PHONE2, PHONE3] } },
          { deviceId: { in: [DEVICE_1, DEVICE_2, DEVICE_3] } },
        ],
      },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.smsCode.deleteMany({ where: { phone: { in: [PHONE2, PHONE3] } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  beforeAll(async () => {
    const m = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SMS_PROVIDER_TOKEN)
      .useClass(FakeSmsProvider)
      .compile();
    app = m.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalFilters(new AppExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        exceptionFactory: (e) =>
          new HttpException(
            {
              code: 'VALIDATION_FAILED',
              message: 'Validation failed',
              details: e,
            },
            400,
          ),
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(() => cleanup());

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function registeredUser(phone: string) {
    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone })
      .expect(204);
    const res = await request(app.getHttpServer())
      .post('/v1/auth/verify-code')
      .send({ phone, code: lastCode })
      .expect(200);
    return res.body as {
      accessToken: string;
      refreshToken: string;
      user: { id: string; phone: string; isGuest: boolean };
    };
  }

  it('гость создаётся и идемпотентен по deviceId', async () => {
    const a = await request(app.getHttpServer())
      .post('/v1/auth/guest')
      .send({ deviceId: DEVICE_1 })
      .expect(200);
    const b = await request(app.getHttpServer())
      .post('/v1/auth/guest')
      .send({ deviceId: DEVICE_1 })
      .expect(200);
    expect(a.body.user.isGuest).toBe(true);
    expect(b.body.user.id).toBe(a.body.user.id);
  });

  it('конверсия сохраняет id и снимает isGuest', async () => {
    const g = await request(app.getHttpServer())
      .post('/v1/auth/guest')
      .send({ deviceId: DEVICE_2 })
      .expect(200);
    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone: PHONE2 })
      .expect(204);
    const c = await request(app.getHttpServer())
      .post('/v1/auth/guest/convert')
      .set('Authorization', `Bearer ${g.body.accessToken}`)
      .send({ phone: PHONE2, code: lastCode })
      .expect(200);
    expect(c.body.user).toMatchObject({
      id: g.body.user.id,
      isGuest: false,
      phone: PHONE2,
    });
  });

  it('конверсия на занятый номер -> 409 PHONE_ALREADY_REGISTERED', async () => {
    await registeredUser(PHONE3);
    const g = await request(app.getHttpServer())
      .post('/v1/auth/guest')
      .send({ deviceId: DEVICE_3 })
      .expect(200);
    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone: PHONE3 })
      .expect(204);
    const res = await request(app.getHttpServer())
      .post('/v1/auth/guest/convert')
      .set('Authorization', `Bearer ${g.body.accessToken}`)
      .send({ phone: PHONE3, code: lastCode })
      .expect(409);
    expect(res.body.error.code).toBe('PHONE_ALREADY_REGISTERED');
  });

  it('конверсия не-гостем -> 403 FORBIDDEN', async () => {
    const u = await registeredUser(PHONE2);
    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone: PHONE3 })
      .expect(204);
    const res = await request(app.getHttpServer())
      .post('/v1/auth/guest/convert')
      .set('Authorization', `Bearer ${u.accessToken}`)
      .send({ phone: PHONE3, code: lastCode })
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('конверсия без токена -> 401', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/guest/convert')
      .send({ phone: PHONE2, code: '1234' })
      .expect(401);
  });
});
