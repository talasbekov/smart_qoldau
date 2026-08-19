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

// Номера спека задачи 4 (E3), не пересекаются с другими спеками.
const PH_E1 = '+77078000001';
const PH_E2 = '+77078000002';
const PH_E3 = '+77078000003';
const PH_C1 = '+77078000091';
const PH_C2 = '+77078000092';
const PH_C3 = '+77078000093';
const PH_C4 = '+77078000094';
const PH_C5 = '+77078000095';
const ALL_PHONES = [PH_E1, PH_E2, PH_E3, PH_C1, PH_C2, PH_C3, PH_C4, PH_C5];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

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

let app: INestApplication;

describe('Заявки: создание, ротация офферов, атомарное принятие (e2e)', () => {
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
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ entity: 'request' }, { entity: 'offer' }],
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

  async function acceptingExpert(
    phone: string,
    overrides: { topics?: string[]; formats?: string[] } = {},
  ) {
    const result = await acceptingExpertHelper(
      app,
      phone,
      () => lastCode,
      overrides,
    );
    registeredExpertIds.push(result.expertId);
    return result;
  }

  async function clientUser(phone: string) {
    return clientUserHelper(app, phone, () => lastCode);
  }

  it('создание: оффер уходит лучшему кандидату, клиент видит SEARCHING, эксперт видит оффер без PII', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);

    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
    expect(r.body.status).toBe('SEARCHING');
    expect(r.body.clientCode).toBeGreaterThanOrEqual(1000);
    expect(r.body.clientCode).toBeLessThan(10000);

    const offers = await get(exp.accessToken, '/v1/experts/me/offers').expect(
      200,
    );
    expect(offers.body[0]).toMatchObject({
      topicSlug: 'anxiety-stress',
      format: 'video',
      clientCode: expect.any(Number),
    });
    expect(JSON.stringify(offers.body)).not.toMatch(/\+77\d{9}/);
    expect(offers.body[0].clientUserId).toBeUndefined();
    expect(offers.body[0].phone).toBeUndefined();
  });

  it('accept атомарен: второй accept того же оффера → 409 OFFER_ALREADY_TAKEN; заявка MATCHED с карточкой эксперта', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C2);

    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);

    const offers = await get(exp.accessToken, '/v1/experts/me/offers').expect(
      200,
    );
    const offerId = offers.body[0].offerId as string;

    const [res1, res2] = await Promise.all([
      post(exp.accessToken, `/v1/offers/${offerId}/accept`),
      post(exp.accessToken, `/v1/offers/${offerId}/accept`),
    ]);
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 409]);
    const okRes = res1.status === 200 ? res1 : res2;
    expect(okRes.body).toMatchObject({
      requestId: r.body.id,
      status: 'MATCHED',
    });
    const failRes = res1.status === 200 ? res2 : res1;
    expect(failRes.body.error.code).toBe('OFFER_ALREADY_TAKEN');

    const status = await get(
      cli.accessToken,
      `/v1/requests/${r.body.id}`,
    ).expect(200);
    expect(status.body.status).toBe('MATCHED');
    expect(status.body.matchedExpert.id).toBe(exp.expertId);
    expect(status.body.matchedExpert.displayName).toBeDefined();
    expect(status.body.matchedExpert.userId).toBeUndefined();
  });

  it('decline → оффер следующему кандидату (двух экспертов, первый отклонил)', async () => {
    const exp1 = await acceptingExpert(PH_E1);
    const exp2 = await acceptingExpert(PH_E2);
    const cli = await clientUser(PH_C3);

    await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);

    const offers1 = await get(exp1.accessToken, '/v1/experts/me/offers').expect(
      200,
    );
    const offers2Before = await get(
      exp2.accessToken,
      '/v1/experts/me/offers',
    ).expect(200);

    // Ровно один из двух экспертов получил первый оффер.
    const firstHasOffer = offers1.body.length === 1;
    const holder = firstHasOffer ? exp1 : exp2;
    const other = firstHasOffer ? exp2 : exp1;
    const holderOffers = firstHasOffer ? offers1.body : offers2Before.body;
    expect(holderOffers.length).toBe(1);

    const offerId = holderOffers[0].offerId as string;
    await post(holder.accessToken, `/v1/offers/${offerId}/decline`).expect(204);

    const otherOffers = await get(
      other.accessToken,
      '/v1/experts/me/offers',
    ).expect(200);
    expect(otherOffers.body.length).toBe(1);

    const holderOffersAfter = await get(
      holder.accessToken,
      '/v1/experts/me/offers',
    ).expect(200);
    expect(holderOffersAfter.body.length).toBe(0);
  });

  it('нет кандидатов → NO_EXPERTS сразу; вторая активная заявка → 409; cancel → CANCELLED и оффер REVOKED', async () => {
    const cli = await clientUser(PH_C4);

    const noExperts = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
    expect(noExperts.body.status).toBe('NO_EXPERTS');

    // Теперь появляется эксперт — вторая заявка того же клиента не активна
    // (первая NO_EXPERTS), должна нормально создаться и получить оффер.
    const exp = await acceptingExpert(PH_E1);
    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
    expect(r.body.status).toBe('SEARCHING');

    // Активная заявка уже есть -> 409.
    const dup = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(409);
    expect(dup.body.error.code).toBe('ACTIVE_REQUEST_EXISTS');

    const cancelled = await post(
      cli.accessToken,
      `/v1/requests/${r.body.id}/cancel`,
    ).expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    const offers = await get(exp.accessToken, '/v1/experts/me/offers').expect(
      200,
    );
    expect(offers.body.length).toBe(0);

    // Заявка уже закрыта -> повторный cancel 409.
    const again = await post(
      cli.accessToken,
      `/v1/requests/${r.body.id}/cancel`,
    ).expect(409);
    expect(again.body.error.code).toBe('REQUEST_ALREADY_CLOSED');
  });

  it('directed-заявка уходит только выбранному эксперту; недоступному → 409 EXPERT_UNAVAILABLE', async () => {
    const exp1 = await acceptingExpert(PH_E1);
    const exp2 = await acceptingExpert(PH_E2);
    const cli = await clientUser(PH_C5);

    const r = await post(cli.accessToken, '/v1/requests')
      .send({
        topicSlug: 'anxiety-stress',
        format: 'video',
        expertId: exp1.expertId,
      })
      .expect(201);
    expect(r.body.status).toBe('SEARCHING');

    const offers1 = await get(exp1.accessToken, '/v1/experts/me/offers').expect(
      200,
    );
    expect(offers1.body.length).toBe(1);
    const offers2 = await get(exp2.accessToken, '/v1/experts/me/offers').expect(
      200,
    );
    expect(offers2.body.length).toBe(0);

    // cancel to free up client for the next sub-case
    await post(cli.accessToken, `/v1/requests/${r.body.id}/cancel`).expect(200);

    // недоступный эксперт (не сматчен пайплайну, например неверифицирован):
    const unavailableExpertId = '00000000-0000-0000-0000-000000000000';
    const bad = await post(cli.accessToken, '/v1/requests')
      .send({
        topicSlug: 'anxiety-stress',
        format: 'video',
        expertId: unavailableExpertId,
      })
      .expect(409);
    expect(bad.body.error.code).toBe('EXPERT_UNAVAILABLE');
  });
});
