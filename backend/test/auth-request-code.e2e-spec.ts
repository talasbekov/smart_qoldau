import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp } from './utils/create-app';

const PHONE = '+77011234567';
const PHONE_RATE_LIMIT = '+77012345678';

describe('Auth request-code (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp(Test.createTestingModule({ imports: [AppModule] }));
    prisma = app.get(PrismaService);
  });

  beforeEach(() =>
    prisma.smsCode.deleteMany({
      where: { phone: { in: [PHONE, PHONE_RATE_LIMIT] } },
    }),
  );

  afterAll(async () => {
    await prisma.smsCode.deleteMany({
      where: { phone: { in: [PHONE, PHONE_RATE_LIMIT] } },
    });
    await app.close();
  });

  it('валидный телефон -> 204, код сохранён', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone: PHONE })
      .expect(204);
    const row = await prisma.smsCode.findUnique({ where: { phone: PHONE } });
    expect(row).not.toBeNull();
    expect(row!.codeHash).not.toMatch(/^\d{4}$/); // хранится хэш, не код
  });

  it('повтор раньше 45 секунд -> 429 SMS_RATE_LIMITED', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone: PHONE_RATE_LIMIT })
      .expect(204);
    const res = await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone: PHONE_RATE_LIMIT })
      .expect(429);
    expect(res.body.error.code).toBe('SMS_RATE_LIMITED');
  });

  it('не-казахстанский номер -> 400', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone: '+79991234567' })
      .expect(400);
  });
});
