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
import {
  clientUser as clientUserHelper,
  guestClient as guestClientHelper,
} from './utils/client-helpers';

// Номера спека задачи 9 (E6), не пересекаются с другими спеками.
const PH_E1 = '+77105000001';
const PH_E2 = '+77105000002';
const PH_C1 = '+77105000091';
const ALL_PHONES = [PH_E1, PH_E2, PH_C1];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

describe('GET /v1/matching/online-count (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let presence: PresenceService;
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
    await prisma.requestCandidate.deleteMany({
      where: { expertId: { in: expertIds } },
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
    presence = app.get(PresenceService);
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

  async function clientToken(): Promise<string> {
    const { accessToken } = await clientUserHelper(app, PH_C1, () => lastCode);
    return accessToken;
  }

  function getOnlineCount(token: string, query: string) {
    return request(app.getHttpServer())
      .get(`/v1/matching/online-count${query}`)
      .set('Authorization', `Bearer ${token}`);
  }

  it('два верифицированных ACCEPTING-эксперта по теме, оба в presence -> count == 2', async () => {
    await acceptingExpert(PH_E1, { topics: ['anxiety-stress'] });
    await acceptingExpert(PH_E2, { topics: ['anxiety-stress'] });
    const token = await clientToken();

    const res = await getOnlineCount(
      token,
      '?topicSlug=anxiety-stress&format=chat',
    ).expect(200);
    expect(res.body).toEqual({ count: 2 });
  });

  it('после presence.setUnavailable одного эксперта -> count == 1', async () => {
    const e1 = await acceptingExpert(PH_E1, { topics: ['anxiety-stress'] });
    await acceptingExpert(PH_E2, { topics: ['anxiety-stress'] });
    await presence.setUnavailable(e1.expertId);
    const token = await clientToken();

    const res = await getOnlineCount(
      token,
      '?topicSlug=anxiety-stress&format=chat',
    ).expect(200);
    expect(res.body).toEqual({ count: 1 });
  });

  it('эксперт другой темы не считается', async () => {
    await acceptingExpert(PH_E1, { topics: ['anxiety-stress'] });
    await acceptingExpert(PH_E2, { topics: ['burnout'] });
    const token = await clientToken();

    const res = await getOnlineCount(
      token,
      '?topicSlug=anxiety-stress&format=chat',
    ).expect(200);
    expect(res.body).toEqual({ count: 1 });
  });

  it('format=video не считает эксперта без video в formats', async () => {
    await acceptingExpert(PH_E1, {
      topics: ['anxiety-stress'],
      formats: ['chat', 'audio'],
    });
    await acceptingExpert(PH_E2, {
      topics: ['anxiety-stress'],
      formats: ['chat', 'audio', 'video'],
    });
    const token = await clientToken();

    const res = await getOnlineCount(
      token,
      '?topicSlug=anxiety-stress&format=video',
    ).expect(200);
    expect(res.body).toEqual({ count: 1 });
  });

  it('urgentOnly=true не считает эксперта с acceptsUrgent=false', async () => {
    await acceptingExpert(PH_E1, { topics: ['anxiety-stress'] }); // acceptsUrgent по умолчанию false
    const token = await clientToken();

    const withoutUrgent = await getOnlineCount(
      token,
      '?topicSlug=anxiety-stress&format=chat',
    ).expect(200);
    expect(withoutUrgent.body).toEqual({ count: 1 });

    const withUrgent = await getOnlineCount(
      token,
      '?topicSlug=anxiety-stress&format=chat&urgentOnly=true',
    ).expect(200);
    expect(withUrgent.body).toEqual({ count: 0 });
  });

  it('неизвестный topicSlug -> count == 0 (без 404)', async () => {
    await acceptingExpert(PH_E1, { topics: ['anxiety-stress'] });
    const token = await clientToken();

    const res = await getOnlineCount(
      token,
      '?topicSlug=no-such-topic&format=chat',
    ).expect(200);
    expect(res.body).toEqual({ count: 0 });
  });

  it('без токена -> 401', async () => {
    await request(app.getHttpServer())
      .get('/v1/matching/online-count?topicSlug=anxiety-stress&format=chat')
      .expect(401);
  });

  it('гостевой токен тоже принимается (БП-10)', async () => {
    await acceptingExpert(PH_E1, { topics: ['anxiety-stress'] });
    const { accessToken } = await guestClientHelper(
      app,
      'device-task9-online-count',
    );

    const res = await getOnlineCount(
      accessToken,
      '?topicSlug=anxiety-stress&format=chat',
    ).expect(200);
    expect(res.body).toEqual({ count: 1 });
  });

  it('без topicSlug -> 400 VALIDATION_FAILED', async () => {
    const token = await clientToken();
    const res = await getOnlineCount(token, '?format=chat').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('недопустимый format -> 400 VALIDATION_FAILED', async () => {
    const token = await clientToken();
    const res = await getOnlineCount(
      token,
      '?topicSlug=anxiety-stress&format=telepathy',
    ).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('в ответе нет PII — только count, без id экспертов', async () => {
    const e1 = await acceptingExpert(PH_E1, { topics: ['anxiety-stress'] });
    const token = await clientToken();

    const res = await getOnlineCount(
      token,
      '?topicSlug=anxiety-stress&format=chat',
    ).expect(200);
    expect(Object.keys(res.body)).toEqual(['count']);
    expect(JSON.stringify(res.body)).not.toContain(e1.expertId);
  });
});
