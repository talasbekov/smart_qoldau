import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { MatchingService } from '../src/matching/matching.service';
import { createApp } from './utils/create-app';
import { acceptingExpert as acceptingExpertHelper } from './utils/expert-helpers';

// Ревью раунд 1 задачи 9 эпика E6, п.1: online-count раньше вызывал
// findCandidates (полный конвейер матчинга) ради одного лишь числа —
// это заявленный, но не измеренный расход БД. Здесь измеряем оба пути на
// одной и той же фикстуре кандидатов, а не полагаемся на догадку.
//
// Номера спека — свой диапазон, не пересекается с другими спеками.
function phone(n: number): string {
  return `+7710600${String(n).padStart(4, '0')}`;
}

let lastCode = '';
class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

describe('online-count: измерение стоимости БД full pipeline vs lean path (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let matching: MatchingService;
  const registeredExpertIds: string[] = [];
  // Полный диапазон телефонов спека — используется в cleanup(), покрывает
  // оба сценария (N=20 и N=60) с запасом.
  const allPhones = Array.from({ length: 200 }, (_, i) => phone(i + 1));

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { in: allPhones } },
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
    registeredExpertIds.length = 0;
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
    await prisma.smsCode.deleteMany({ where: { phone: { in: allPhones } } });
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
    matching = app.get(MatchingService);
  });

  beforeEach(() => cleanup());

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  // N ACCEPTING+VERIFIED экспертов на одной теме/формате, все с живым
  // presence и расписанием 24/7 — реальный путь через HTTP (register ->
  // verify -> profile -> документы -> submit -> админ-approve ->
  // work-status ACCEPTING), а не прямые записи в БД в обход прод-кода.
  //
  // Строго последовательно, не Promise.all: FakeSmsProvider (как и во всех
  // остальных спеках эпика) хранит последний код в одной общей переменной
  // lastCode — параллельные register-code/verify-code гонялись бы за одним
  // и тем же полем и перетирали код друг друга.
  async function seedAcceptingExperts(count: number, offset: number) {
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(
        await acceptingExpertHelper(app, phone(offset + i), () => lastCode, {
          topics: ['anxiety-stress'],
        }),
      );
    }
    registeredExpertIds.push(...results.map((r) => r.expertId));
    return results;
  }

  interface Counts {
    expertFindMany: number;
    scheduleFindUnique: number;
    scoringFindMany: number;
    todayOffersCount: number;
  }

  function attachSpies() {
    return {
      expertFindMany: jest.spyOn(prisma.expert, 'findMany'),
      scheduleFindUnique: jest.spyOn(prisma.expertScheduleDay, 'findUnique'),
      scoringFindMany: jest.spyOn(prisma.requestCandidate, 'findMany'),
      todayOffersCount: jest.spyOn(prisma.requestCandidate, 'count'),
    };
  }

  function readAndClear(spies: ReturnType<typeof attachSpies>): Counts {
    const counts: Counts = {
      expertFindMany: spies.expertFindMany.mock.calls.length,
      scheduleFindUnique: spies.scheduleFindUnique.mock.calls.length,
      scoringFindMany: spies.scoringFindMany.mock.calls.length,
      todayOffersCount: spies.todayOffersCount.mock.calls.length,
    };
    Object.values(spies).forEach((s) => s.mockClear());
    return counts;
  }

  function total(c: Counts): number {
    return (
      c.expertFindMany +
      c.scheduleFindUnique +
      c.scoringFindMany +
      c.todayOffersCount
    );
  }

  async function measure(n: number, offset: number) {
    await seedAcceptingExperts(n, offset);
    const params = { topicSlug: 'anxiety-stress', format: 'chat' };
    const spies = attachSpies();

    const ids = await matching.findCandidates(params);
    const full = readAndClear(spies);

    const count = await matching.countCandidates(params);
    const lean = readAndClear(spies);

    Object.values(spies).forEach((s) => s.mockRestore());

    // eslint-disable-next-line no-console
    console.log(
      `[perf online-count] N=${n}: full pipeline (findCandidates) = ` +
        `${JSON.stringify(full)} (итого ${total(full)} запросов); ` +
        `lean path (countCandidates) = ${JSON.stringify(lean)} ` +
        `(итого ${total(lean)} запросов)`,
    );

    return { ids, count, full, lean };
  }

  it('N=20 подходящих: lean path не трогает scoring/today-count, число совпадает с findCandidates', async () => {
    const { ids, count, full, lean } = await measure(20, 1);

    expect(ids).toHaveLength(20);
    expect(count).toBe(20);
    expect(count).toBe(ids.length);

    // Полный конвейер реально дорогой — иначе не с чем сравнивать.
    expect(full.scoringFindMany).toBe(20);
    expect(full.todayOffersCount).toBe(20);
    expect(full.scheduleFindUnique).toBe(20);
    expect(full.expertFindMany).toBe(1);

    // Экономный путь не должен звать ScoringService и подсчёт офферов
    // вообще — это провабельно выброшенная работа, а не мелкая оптимизация.
    expect(lean.scoringFindMany).toBe(0);
    expect(lean.todayOffersCount).toBe(0);
    expect(lean.scheduleFindUnique).toBe(20);
    expect(lean.expertFindMany).toBe(1);

    expect(total(lean)).toBeLessThan(total(full));
  }, 60_000);

  it('N=60 подходящих: та же зависимость 1+3N vs 1+N при большем N', async () => {
    const { ids, count, full, lean } = await measure(60, 101);

    expect(ids).toHaveLength(60);
    expect(count).toBe(60);
    expect(count).toBe(ids.length);

    expect(full.scoringFindMany).toBe(60);
    expect(full.todayOffersCount).toBe(60);
    expect(total(full)).toBe(1 + 3 * 60);

    expect(lean.scoringFindMany).toBe(0);
    expect(lean.todayOffersCount).toBe(0);
    expect(total(lean)).toBe(1 + 60);

    expect(total(lean)).toBeLessThan(total(full));
  }, 120_000);
});
