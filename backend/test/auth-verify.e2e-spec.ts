import { Test } from '@nestjs/testing';
import {
  Controller,
  Get,
  HttpException,
  INestApplication,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/common/filters/app-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { CurrentUser } from '../src/auth/current-user.decorator';
import { JwtPayload } from '../src/auth/jwt.strategy';

// Бриф-константа +77011234567 занята спеком задачи 5
// (auth-request-code.e2e-spec.ts) — используем отдельный номер спека.
const PHONE = '+77019876543';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

// Тестовый контроллер для проверки JwtAuthGuard и @CurrentUser();
// подключается только в тестовом модуле (в проде guard применяется задачей 7).
@Controller('guard-check')
class GuardCheckController {
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: JwtPayload): JwtPayload {
    return user;
  }
}

describe('Auth verify-code / refresh (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { in: [PHONE] } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.smsCode.deleteMany({ where: { phone: { in: [PHONE] } } });
    await prisma.user.deleteMany({ where: { phone: { in: [PHONE] } } });
  }

  beforeAll(async () => {
    const m = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [GuardCheckController],
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

  it('защищённый маршрут без токена -> 401 в едином формате', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/guard-check/me')
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toEqual(expect.any(String));
  });

  it('защищённый маршрут с валидным access-токеном -> 200 и {sub, isGuest}', async () => {
    const { accessToken, user } = await login();
    const res = await request(app.getHttpServer())
      .get('/v1/guard-check/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body).toEqual({ sub: user.id, isGuest: false });
  });
});
