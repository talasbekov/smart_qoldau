import { Test } from '@nestjs/testing';
import {
  HttpException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/common/filters/app-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';

const PHONE = '+77019876543';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

describe('Auth verify-code / refresh (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.smsCode.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.smsCode.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  async function login() {
    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone: PHONE })
      .expect(204);
    const res = await request(app.getHttpServer())
      .post('/v1/auth/verify-code')
      .send({ phone: PHONE, code: lastCode })
      .expect(200);
    return res.body as {
      accessToken: string;
      refreshToken: string;
      user: { id: string; phone: string; isGuest: boolean };
    };
  }

  it('верный код -> токены и новый пользователь', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone: PHONE })
      .expect(204);
    const res = await request(app.getHttpServer())
      .post('/v1/auth/verify-code')
      .send({ phone: PHONE, code: lastCode })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user).toMatchObject({ phone: PHONE, isGuest: false });
  });

  it('неверный код -> 400 SMS_CODE_INVALID', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone: PHONE })
      .expect(204);
    const res = await request(app.getHttpServer())
      .post('/v1/auth/verify-code')
      .send({ phone: PHONE, code: '0000' })
      .expect(400);
    expect(res.body.error.code).toBe('SMS_CODE_INVALID');
  });

  it('refresh ротируется: старый токен отзывается', async () => {
    const { refreshToken } = await login();
    const r1 = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);
    expect(r1.body.refreshToken).not.toBe(refreshToken);
  });
});
