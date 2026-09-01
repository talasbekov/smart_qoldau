import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { CandidateResponse } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ScoringService } from '../src/matching/scoring.service';
import { createApp } from './utils/create-app';

// Скоринг Р-12 существует в двух видах: одиночный `score` (остался для
// точечных проверок) и пакетный `scoreMany`, который матчинг зовёт на весь
// список кандидатов одним SQL с оконной функцией (карточка #28 —
// нагрузочный прогон E11 показал, что запрос на каждого кандидата давал
// 30 секунд на POST /requests при 500 онлайн).
//
// Две реализации одной формулы разъезжаются молча, поэтому спек сверяет их
// на одних и тех же данных: разные истории офферов, включая пограничные
// (только TIMEOUT, только ответы, пустая история, окно ровно на границе 50).
//
// Свой диапазон телефонов, не пересекается с другими спеками.
const PHONE_PREFIX = '+7710700';

function phone(n: number): string {
  return `${PHONE_PREFIX}${String(n).padStart(4, '0')}`;
}

describe('Скоринг Р-12: пакетный scoreMany совпадает с одиночным score (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let scoring: ScoringService;
  const expertIds: string[] = [];

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { startsWith: PHONE_PREFIX } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const experts = await prisma.expert.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const ids = experts.map((e) => e.id);
    await prisma.requestCandidate.deleteMany({
      where: { expertId: { in: ids } },
    });
    await prisma.request.deleteMany({
      where: { clientUserId: { in: userIds } },
    });
    await prisma.expertTopic.deleteMany({ where: { expertId: { in: ids } } });
    await prisma.expert.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  /// Эксперт + заявка-донор, к которой цепляются офферы: `RequestCandidate`
  /// без заявки не существует, а содержание заявки для скоринга неважно.
  async function seedExpert(index: number): Promise<{
    expertId: string;
    requestId: string;
  }> {
    const user = await prisma.user.create({ data: { phone: phone(index) } });
    const topic = await prisma.topic.findFirstOrThrow();
    const expert = await prisma.expert.create({
      data: {
        userId: user.id,
        displayName: `Скоринг ${index}`,
        city: 'Алматы',
        experience: 'FIVE_TO_TEN',
        education: 'КазНУ',
        priceTiyn: 399000,
        languages: ['ru'],
        formats: ['chat'],
        verificationStatus: 'VERIFIED',
      },
    });
    const request = await prisma.request.create({
      data: {
        clientUserId: user.id,
        clientCode: 1000 + index,
        topicId: topic.id,
        format: 'chat',
        status: 'SEARCHING',
      },
    });
    expertIds.push(expert.id);
    return { expertId: expert.id, requestId: request.id };
  }

  async function addOffers(
    expertId: string,
    requestId: string,
    offers: { response: CandidateResponse; responseSec: number | null }[],
  ) {
    // offeredAt разнесён по минутам: порядок «последних 50» должен быть
    // определённым, иначе сравнение двух реализаций ничего не докажет.
    let offeredAt = new Date('2026-08-01T00:00:00Z').getTime();
    for (const offer of offers) {
      offeredAt += 60_000;
      await prisma.requestCandidate.create({
        data: {
          requestId,
          expertId,
          response: offer.response,
          offeredAt: new Date(offeredAt),
          // Обязательное поле модели; на скоринг не влияет — берём
          // штатные 45 секунд обычного оффера.
          deadlineAt: new Date(offeredAt + 45_000),
          respondedAt:
            offer.responseSec === null
              ? null
              : new Date(offeredAt + offer.responseSec * 1000),
        },
      });
    }
  }

  beforeAll(async () => {
    app = await createApp(Test.createTestingModule({ imports: [AppModule] }));
    prisma = app.get(PrismaService);
    scoring = app.get(ScoringService);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('на любых историях офферов обе реализации дают один и тот же скор', async () => {
    // 1. Смешанная история: приёмы, отказы, таймауты, разная скорость.
    const mixed = await seedExpert(1);
    await addOffers(mixed.expertId, mixed.requestId, [
      { response: CandidateResponse.ACCEPTED, responseSec: 5 },
      { response: CandidateResponse.ACCEPTED, responseSec: 40 },
      { response: CandidateResponse.DECLINED, responseSec: 20 },
      { response: CandidateResponse.TIMEOUT, responseSec: null },
    ]);

    // 2. Только таймауты: acceptRate 0, speed 0 — скор обязан быть 0, а не
    //    нейтральные 0.5 «как без истории».
    const timeouts = await seedExpert(2);
    await addOffers(timeouts.expertId, timeouts.requestId, [
      { response: CandidateResponse.TIMEOUT, responseSec: null },
      { response: CandidateResponse.TIMEOUT, responseSec: null },
    ]);

    // 3. Мгновенные приёмы: верхняя граница скора.
    const fast = await seedExpert(3);
    await addOffers(fast.expertId, fast.requestId, [
      { response: CandidateResponse.ACCEPTED, responseSec: 0 },
      { response: CandidateResponse.ACCEPTED, responseSec: 1 },
    ]);

    // 4. Ответ дольше целевых 45 секунд: speed зажимается в 0, не уходит
    //    в минус.
    const slow = await seedExpert(4);
    await addOffers(slow.expertId, slow.requestId, [
      { response: CandidateResponse.ACCEPTED, responseSec: 300 },
    ]);

    // 5. Больше 50 офферов: старые в окно не попадают. Первые 50 (свежие) —
    //    отказы, дальше приёмы, которые обязаны остаться за границей окна.
    const windowed = await seedExpert(5);
    await addOffers(windowed.expertId, windowed.requestId, [
      ...Array.from({ length: 10 }, () => ({
        response: CandidateResponse.ACCEPTED,
        responseSec: 3,
      })),
      ...Array.from({ length: 50 }, () => ({
        response: CandidateResponse.DECLINED,
        responseSec: 10,
      })),
    ]);

    // 6. Пустая история: нейтральные 0.5.
    const fresh = await seedExpert(6);

    const ids = [
      mixed.expertId,
      timeouts.expertId,
      fast.expertId,
      slow.expertId,
      windowed.expertId,
      fresh.expertId,
    ];

    const batch = await scoring.scoreMany(ids);
    for (const id of ids) {
      const single = await scoring.score(id);
      expect(batch.get(id)).toBeCloseTo(single, 10);
    }

    // Заодно закрепляем сами значения, иначе тест доказывал бы лишь
    // одинаковость двух одинаково сломанных реализаций.
    expect(batch.get(fresh.expertId)).toBe(0.5);
    expect(batch.get(timeouts.expertId)).toBe(0);
    expect(batch.get(slow.expertId)).toBeCloseTo(0.6, 10); // acceptRate 1, speed 0
    // Окно отсекло приёмы: остались одни отказы, acceptRate 0.
    expect(batch.get(windowed.expertId)).toBeCloseTo(
      0 * 0.6 + Math.max(0, 1 - 10 / 45) * 0.4,
      10,
    );
  }, 60_000);

  it('пустой список не идёт в базу и возвращает пустую карту', async () => {
    const spy = jest.spyOn(prisma, '$queryRaw');
    const result = await scoring.scoreMany([]);
    expect(result.size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
