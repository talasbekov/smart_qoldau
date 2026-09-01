import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { PresenceService } from '../src/presence/presence.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { acceptingExpert as acceptingExpertHelper } from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Номера спека задачи 8 (E5, abuse-гейт), не пересекаются с другими спеками.
const PH_E1 = '+77091000001';
const PH_E2 = '+77091000002';
const PH_C1 = '+77091000091';
const PH_C2 = '+77091000092';
const ALL_PHONES = [PH_E1, PH_E2, PH_C1, PH_C2];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    lastCode = match ? match[1] : '';
  }
}

let app: INestApplication;

function post(token: string, url: string) {
  return request(app.getHttpServer())
    .post(url)
    .set('Authorization', `Bearer ${token}`);
}
function get(token: string, url: string) {
  return request(app.getHttpServer())
    .get(url)
    .set('Authorization', `Bearer ${token}`);
}

describe('Abuse-гейт автоподбора (E5, задача 8, Р-01/Р-17)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  const registeredExpertIds: string[] = [];

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const experts = await prisma.expert.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const expertIds = experts.map((e) => e.id);
    if (registeredExpertIds.length) {
      await redis.srem('experts:available', ...registeredExpertIds);
      await redis.hdel('experts:lastseen', ...registeredExpertIds);
    }
    if (userIds.length) {
      await redis.del(...userIds.map((id) => `abuse:client:${id}`));
    }
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entity: 'request' },
          { entity: 'offer' },
          { entity: 'consultation' },
          { entity: 'expert', entityId: { in: expertIds } },
        ],
      },
    });
    await prisma.consultation.deleteMany({
      where: {
        OR: [
          { expertId: { in: expertIds } },
          { clientUserId: { in: userIds } },
        ],
      },
    });
    await prisma.requestCandidate.deleteMany({
      where: {
        OR: [
          { expertId: { in: expertIds } },
          { request: { clientUserId: { in: userIds } } },
        ],
      },
    });
    await prisma.request.deleteMany({
      where: { clientUserId: { in: userIds } },
    });
    await prisma.expertScheduleDay.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expertDocument.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expertTopic.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expert.deleteMany({ where: { id: { in: expertIds } } });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...userIds, ...expertIds] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    registeredExpertIds.length = 0;
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    app.get(PresenceService);
  });

  beforeEach(() => cleanup());

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function acceptingExpert(phone: string) {
    const result = await acceptingExpertHelper(app, phone, () => lastCode);
    registeredExpertIds.push(result.expertId);
    return result;
  }

  async function clientUser(phone: string) {
    return clientUserHelper(app, phone, () => lastCode);
  }

  // Полный флоу: заявка -> оффер -> accept -> ACTIVE консультация -> отмена
  // клиентом (инкремент abuse:client:{userId} в ConsultationsService.cancel).
  async function fullFlowWithCancel(
    cli: { accessToken: string },
    exp: { accessToken: string; expertId: string },
  ) {
    await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
    const offers = await get(exp.accessToken, '/v1/experts/me/offers').expect(
      200,
    );
    const offerId = offers.body[0].offerId as string;
    const accepted = await post(
      exp.accessToken,
      `/v1/offers/${offerId}/accept`,
    ).expect(200);
    const consultationId = accepted.body.consultationId as string;
    await post(
      cli.accessToken,
      `/v1/consultations/${consultationId}/cancel`,
    ).expect(200);
  }

  it('3 отмены клиентом -> 4-я авто-заявка 403 AUTO_MATCH_DISABLED + audit; направленная заявка проходит', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);

    for (let i = 0; i < 3; i++) {
      await fullFlowWithCancel(cli, exp);
    }

    const blocked = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(403);
    expect(blocked.body.error.code).toBe('AUTO_MATCH_DISABLED');
    expect(blocked.body.error.message).toContain('вручную');

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'request', transition: 'request.auto_match_blocked' },
    });
    expect(audit?.payload).toMatchObject({ abuseCount: 3 });

    // Направленная заявка (выбор из каталога вручную) проходит всегда.
    const directed = await post(cli.accessToken, '/v1/requests')
      .send({
        topicSlug: 'anxiety-stress',
        format: 'video',
        expertId: exp.expertId,
      })
      .expect(201);
    expect(directed.body.id).toBeTruthy();
  });

  it('клиент с 2 отменами -> авто-заявка проходит; + no-show (3-й инцидент, Р-01) -> автоподбор закрыт', async () => {
    const exp = await acceptingExpert(PH_E2);
    const cli = await clientUser(PH_C2);

    for (let i = 0; i < 2; i++) {
      await fullFlowWithCancel(cli, exp);
    }

    // 2 инцидента < 3 — автоподбор ещё работает; заявка сразу идёт в дело:
    // эксперт принимает, клиент не приходит -> CLIENT_NO_SHOW (3-й инцидент).
    await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
    const offers = await get(exp.accessToken, '/v1/experts/me/offers').expect(
      200,
    );
    const accepted = await post(
      exp.accessToken,
      `/v1/offers/${offers.body[0].offerId as string}/accept`,
    ).expect(200);
    await post(
      exp.accessToken,
      `/v1/consultations/${accepted.body.consultationId as string}/complete`,
    )
      .send({ outcome: 'CLIENT_NO_SHOW' })
      .expect(200);

    const blocked = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(403);
    expect(blocked.body.error.code).toBe('AUTO_MATCH_DISABLED');
  });
});
