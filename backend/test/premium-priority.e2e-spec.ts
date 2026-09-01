import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHash, randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { RequestsService } from '../src/requests/requests.service';
import { createApp } from './utils/create-app';
import { acceptingExpert as acceptingExpertHelper } from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Р-08 обещает Premium «приоритетный подбор». Механика (решение 3 плана
// E12): равные по скору кандидаты разводятся по разным заявкам (#29) ради
// пропускной способности базового потока — Premium-заявка этого разведения
// НЕ получает и достаётся лучшему из равных. Наблюдаемо это только на
// полной ничьей: seed работает исключительно как tie-break.
//
// Заявки заводятся напрямую с подобранным id, а не через HTTP: id — это и
// есть seed, и подобрать его можно только заранее. Иначе спек проверял бы
// «повезло/не повезло».
const PH_E1 = '+77087400001';
const PH_E2 = '+77087400002';
const PH_C_BASE = '+77087400091';
const PH_C_PREMIUM = '+77087400092';
const ALL_PHONES = [PH_E1, PH_E2, PH_C_BASE, PH_C_PREMIUM];

const VISA_PAN = '4111111111111111';

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

// Та же функция, что в MatchingService: seed раскладывает равных.
function tieRank(expertId: string, seed: string): number {
  return createHash('md5')
    .update(`${seed}:${expertId}`)
    .digest()
    .readUInt32BE(0);
}

// id заявки, при котором seed поставил бы ВТОРОГО эксперта первым: только
// на таком id видно, применён seed или нет.
function seedFavouring(loserFirst: string, winnerFirst: string): string {
  for (let i = 0; i < 1000; i++) {
    const id = randomUUID();
    if (tieRank(winnerFirst, id) < tieRank(loserFirst, id)) return id;
  }
  throw new Error('не удалось подобрать seed — проверьте tieRank');
}

describe('Premium: приоритетный подбор (Р-08, e2e)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  let requests: RequestsService;
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
    const subs = await prisma.subscription.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const txs = subs.length
      ? await prisma.ledgerTransaction.findMany({
          where: {
            kind: 'subscription_charge',
            OR: subs.map((s) => ({ refId: { startsWith: s.id } })),
          },
          select: { id: true },
        })
      : [];
    const txIds = txs.map((t) => t.id);
    await prisma.ledgerEntry.deleteMany({
      where: { transactionId: { in: txIds } },
    });
    await prisma.ledgerTransaction.deleteMany({ where: { id: { in: txIds } } });
    await prisma.subscription.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.paymentMethod.deleteMany({
      where: { userId: { in: userIds } },
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
    requests = app.get(RequestsService);
  });

  beforeEach(() => cleanup());

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  /// Два эксперта без истории: скор у обоих 0.5, офферов сегодня нет —
  /// полная ничья. Первый зарегистрированный идёт первым при разрешении
  /// ничьей без seed (порядок выборки).
  async function tiedExperts() {
    const e1 = await acceptingExpertHelper(app, PH_E1, () => lastCode);
    registeredExpertIds.push(e1.expertId);
    const e2 = await acceptingExpertHelper(app, PH_E2, () => lastCode);
    registeredExpertIds.push(e2.expertId);
    return { e1, e2 };
  }

  async function makeRequest(id: string, clientUserId: string) {
    const topic = await prisma.topic.findUniqueOrThrow({
      where: { slug: 'anxiety-stress' },
    });
    await prisma.request.create({
      data: {
        id,
        clientUserId,
        clientCode: 4242,
        topicId: topic.id,
        format: 'chat',
      },
    });
    await requests.offerToNext(id);
    const candidate = await prisma.requestCandidate.findFirstOrThrow({
      where: { requestId: id },
    });
    return candidate.expertId;
  }

  it('базовая заявка при ничьей разводится сидом', async () => {
    const { e1, e2 } = await tiedExperts();
    const client = await clientUserHelper(app, PH_C_BASE, () => lastCode);

    // id подобран так, что seed ставит первым ВТОРОГО эксперта.
    const requestId = seedFavouring(e1.expertId, e2.expertId);
    expect(await makeRequest(requestId, client.userId)).toBe(e2.expertId);
  });

  it('Premium-заявка при той же ничьей уходит лучшему, а не разведённому сидом', async () => {
    const { e1, e2 } = await tiedExperts();
    const client = await clientUserHelper(app, PH_C_PREMIUM, () => lastCode);
    const card = await post(client.accessToken, '/v1/payment-methods')
      .send({ pan: VISA_PAN, expiry: '12/28', holderName: 'Ivan Petrov' })
      .expect(201);
    await post(client.accessToken, '/v1/premium/subscribe')
      .send({ plan: 'MONTH', paymentMethodId: card.body.id })
      .expect(201);

    // Тот же вид id: базовой заявке он отдал бы второго эксперта.
    const requestId = seedFavouring(e1.expertId, e2.expertId);
    expect(await makeRequest(requestId, client.userId)).toBe(e1.expertId);
  });
});
