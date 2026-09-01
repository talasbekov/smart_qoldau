import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { MatchingService } from '../src/matching/matching.service';
import { createApp } from './utils/create-app';
import { acceptingExpert as acceptingExpertHelper } from './utils/expert-helpers';

// Находка нагрузочного прогона E11: при полной ничьей (все кандидаты
// одинаково новые, скор у всех 0.5, офферов сегодня ни у кого) порядок
// кандидатов был один и тот же для всех заявок сразу — и весь поток бился
// в одного и того же специалиста. 4190 отказов «уже занят» на 200
// успешных приёмов, пока сотни свободных простаивали.
//
// Спек фиксирует обе стороны требования: разложение зависит от заявки, но
// для одной и той же заявки воспроизводимо (иначе ротация офферов и спеки
// на ничью стали бы недетерминированными).
//
// Свой диапазон номеров, не пересекается с другими спеками.
function phone(n: number): string {
  return `+7710800${String(n).padStart(4, '0')}`;
}

const EXPERTS = 8;

let lastCode = '';
class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    lastCode = match ? match[1] : '';
  }
}

describe('Матчинг: равные кандидаты раскладываются по-разному для разных заявок', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let matching: MatchingService;
  const registeredExpertIds: string[] = [];
  const allPhones = Array.from({ length: EXPERTS }, (_, i) => phone(i + 1));

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
    await prisma.requestCandidate.deleteMany({
      where: { expertId: { in: expertIds } },
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
    matching = app.get(MatchingService);
    await cleanup();

    // Все восемь заводятся одинаково: ни у кого нет истории офферов,
    // значит скор у всех 0.5 и ничья полная.
    for (let i = 0; i < EXPERTS; i++) {
      const expert = await acceptingExpertHelper(
        app,
        phone(i + 1),
        () => lastCode,
        { topics: ['anxiety-stress'] },
      );
      registeredExpertIds.push(expert.expertId);
    }
  }, 120_000);

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  const params = { topicSlug: 'anxiety-stress', format: 'chat' };

  it('первый кандидат зависит от заявки: поток не бьётся в одного и того же', async () => {
    const firstPicks = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const ranked = await matching.findCandidates({
        ...params,
        tieBreakSeed: `request-${i}`,
      });
      expect(ranked).toHaveLength(EXPERTS);
      firstPicks.add(ranked[0]);
    }

    // Двадцать заявок на восьми равных кандидатах: строгого распределения
    // хеш не гарантирует, но упереться в одного-двух он не должен.
    expect(firstPicks.size).toBeGreaterThanOrEqual(4);
  }, 60_000);

  it('для одной и той же заявки порядок воспроизводим', async () => {
    const first = await matching.findCandidates({
      ...params,
      tieBreakSeed: 'request-fixed',
    });
    const second = await matching.findCandidates({
      ...params,
      tieBreakSeed: 'request-fixed',
    });
    expect(second).toEqual(first);
  }, 60_000);

  it('без seed порядок прежний — порядок выборки, а не случайный', async () => {
    const first = await matching.findCandidates(params);
    const second = await matching.findCandidates(params);
    expect(second).toEqual(first);
  }, 60_000);
});
