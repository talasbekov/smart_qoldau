// Р-27: психолог видит имя и историю встреч клиента. Согласие
// спрашивается ОДИН раз, перед первой заявкой, и проверяется на сервере:
// экран согласия можно обойти, дёрнув API напрямую, а инвариант — нет.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    lastCode = match ? match[1] : '';
  }
}

const PHONE = '+77015551201';

describe('Согласие на видимость психологу (Р-27, e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function login(): Promise<string> {
    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone: PHONE })
      .expect(204);
    const res = await request(app.getHttpServer())
      .post('/v1/auth/verify-code')
      .send({ phone: PHONE, code: lastCode })
      .expect(200);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
  });

  // Удалять пользователя можно только после того, что на него ссылается:
  // refresh-токены, заявки и их кандидаты.
  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: PHONE },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (ids.length === 0) return;

    await prisma.requestCandidate.deleteMany({
      where: { request: { clientUserId: { in: ids } } },
    });
    await prisma.request.deleteMany({ where: { clientUserId: { in: ids } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('без согласия заявка не создаётся', async () => {
    const token = await login();

    const res = await request(app.getHttpServer())
      .post('/v1/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ topicSlug: 'anxiety-stress', format: 'chat' })
      .expect(409);

    expect(res.body.error.code).toBe('EXPERT_VISIBILITY_CONSENT_REQUIRED');
  });

  it('новый человек согласия ещё не дал', async () => {
    const token = await login();

    const res = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.expertVisibilityAcceptedAt).toBeNull();
    expect(res.body.displayName).toBeNull();
  });

  it('согласие принимается вместе с именем и сразу видно в профиле', async () => {
    const token = await login();

    await request(app.getHttpServer())
      .post('/v1/me/expert-visibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Айгерим' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get('/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.displayName).toBe('Айгерим');
    expect(res.body.expertVisibilityAcceptedAt).not.toBeNull();
  });

  it('повторное согласие НЕ переписывает дату', async () => {
    const token = await login();

    const first = await request(app.getHttpServer())
      .post('/v1/me/expert-visibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Айгерим' })
      .expect(200);

    const second = await request(app.getHttpServer())
      .post('/v1/me/expert-visibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Айгерим Т.' })
      .expect(200);

    // Дата согласия — граница между «до» и «после». Сдвинув её, мы задним
    // числом раскрыли бы консультации, проходившие под анонимностью.
    expect(second.body.expertVisibilityAcceptedAt).toBe(
      first.body.expertVisibilityAcceptedAt,
    );
    // А имя поменять можно: человек передумал, как его звать.
    expect(second.body.displayName).toBe('Айгерим Т.');
  });

  it('пустое имя не принимается: согласие без имени бессмысленно', async () => {
    const token = await login();

    await request(app.getHttpServer())
      .post('/v1/me/expert-visibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: '' })
      .expect(400);
  });

  it('после согласия заявка создаётся', async () => {
    const token = await login();
    await request(app.getHttpServer())
      .post('/v1/me/expert-visibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Айгерим' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/requests')
      .set('Authorization', `Bearer ${token}`)
      .send({ topicSlug: 'anxiety-stress', format: 'chat' })
      .expect(201);
  });
});
