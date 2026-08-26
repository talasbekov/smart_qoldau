import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { acceptingExpert as acceptingExpertHelper } from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Спек написан по находке нагрузочного прогона E11: пока эксперт онлайн,
// офферы двух разных заявок уходят ему обоим (BUSY он становится только
// ПОСЛЕ коммита первого accept). Если он примет оба одновременно —
// приложение обязано отдать доменный отказ, а не 500, и в базе обязана
// остаться ровно одна активная консультация: вести две сразу человек не
// может, а деньги висят на каждой.
//
// Свой диапазон номеров, не пересекается с другими спеками.
const PH_E1 = '+77086000001';
const PH_C1 = '+77086000091';
const PH_C2 = '+77086000092';
const ALL_PHONES = [PH_E1, PH_C1, PH_C2];

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

describe('Гонка приёма офферов одним экспертом (находка нагрузки E11)', () => {
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
  });

  beforeEach(() => cleanup());

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('два оффера, принятые одновременно: один MATCHED, второй — доменный отказ, активная консультация одна', async () => {
    const expert = await acceptingExpertHelper(app, PH_E1, () => lastCode);
    registeredExpertIds.push(expert.expertId);
    const c1 = await clientUserHelper(app, PH_C1, () => lastCode);
    const c2 = await clientUserHelper(app, PH_C2, () => lastCode);

    // Обе заявки создаются, пока эксперт ещё ACCEPTING, поэтому оба
    // оффера адресованы ему.
    await post(c1.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'chat' })
      .expect(201);
    await post(c2.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'chat' })
      .expect(201);

    const offers = await get(
      expert.accessToken,
      '/v1/experts/me/offers',
    ).expect(200);
    expect(offers.body).toHaveLength(2);
    const [first, second] = offers.body.map(
      (o: { offerId: string }) => o.offerId,
    );

    const responses = await Promise.all([
      post(expert.accessToken, `/v1/offers/${first}/accept`),
      post(expert.accessToken, `/v1/offers/${second}/accept`),
    ]);

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses[0]).toBe(200);
    // Отказ — доменный: 409 (занят/оффер уже неактуален) или 410
    // (оффер истёк). 500 означал бы, что приложение развалилось на
    // штатной гонке.
    expect([409, 410]).toContain(statuses[1]);
    const rejected = responses.find((r) => r.status !== 200)!;
    expect(rejected.body.error.code).not.toBe('INTERNAL');

    const active = await prisma.consultation.count({
      where: { expertId: expert.expertId, status: 'ACTIVE' },
    });
    expect(active).toBe(1);
  });
});
