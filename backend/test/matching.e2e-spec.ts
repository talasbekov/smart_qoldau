import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { MatchingService } from '../src/matching/matching.service';
import { createApp } from './utils/create-app';
import {
  acceptingExpert as acceptingExpertHelper,
  putScheduleAllDisabled as putScheduleAllDisabledHelper,
} from './utils/expert-helpers';

// Номера спека задачи 2 (E3), не пересекаются с другими спеками.
const PH1 = '+77075000001';
const PH2 = '+77075000002';
const PH3 = '+77075000003';
const PH4 = '+77075000004';
const PH5 = '+77075000005';
const PH6 = '+77075000006';
const PH_CLIENT = '+77075000099';
const ALL_PHONES = [PH1, PH2, PH3, PH4, PH5, PH6, PH_CLIENT];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

describe('Matching pipeline + scoring (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let matching: MatchingService;
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
    if (registeredExpertIds.length)
      await redis.srem('experts:available', ...registeredExpertIds);
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
    matching = app.get(MatchingService);
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

  async function putScheduleAllDisabled(accessToken: string) {
    await putScheduleAllDisabledHelper(app, accessToken);
  }

  // прямые вставки prisma: создаёт фиктивный Request (клиент - отдельный
  // тестовый user) и вешает на него N кандидатов с заданными исходами.
  // PENDING-офферы не влияют на score (окно скоринга — только завершённые),
  // но считаются в tie-break «офферы за сегодня».
  // opts.offeredAt — момент оффера (по умолчанию сейчас);
  // opts.responseDelaySec — respondedAt = offeredAt + delay (по умолчанию 0).
  async function seedCandidateHistory(
    expertId: string,
    outcomes: {
      accepted?: number;
      declined?: number;
      timeout?: number;
      pending?: number;
    },
    opts: { offeredAt?: Date; responseDelaySec?: number } = {},
  ) {
    const clientUser = await prisma.user.upsert({
      where: { phone: PH_CLIENT },
      update: {},
      create: { phone: PH_CLIENT, locale: 'ru' },
    });
    const topic = await prisma.topic.findUniqueOrThrow({
      where: { slug: 'anxiety-stress' },
    });
    const req = await prisma.request.create({
      data: {
        clientUserId: clientUser.id,
        clientCode: 9999,
        topicId: topic.id,
        format: 'video',
      },
    });

    type SeedResponse = 'ACCEPTED' | 'DECLINED' | 'TIMEOUT' | 'PENDING';
    const rows: {
      requestId: string;
      expertId: string;
      offeredAt: Date;
      deadlineAt: Date;
      respondedAt: Date | null;
      response: SeedResponse;
    }[] = [];
    const offeredAt = opts.offeredAt ?? new Date();
    const respondedAt = new Date(
      offeredAt.getTime() + (opts.responseDelaySec ?? 0) * 1000,
    );
    const push = (response: SeedResponse, count: number) => {
      for (let i = 0; i < count; i++) {
        rows.push({
          requestId: req.id,
          expertId,
          offeredAt,
          deadlineAt: new Date(offeredAt.getTime() + 30_000),
          respondedAt:
            response === 'ACCEPTED' || response === 'DECLINED'
              ? respondedAt
              : null,
          response,
        });
      }
    };
    push('ACCEPTED', outcomes.accepted ?? 0);
    push('DECLINED', outcomes.declined ?? 0);
    push('TIMEOUT', outcomes.timeout ?? 0);
    push('PENDING', outcomes.pending ?? 0);

    await prisma.requestCandidate.createMany({ data: rows });
  }

  it('конвейер отсекает: не-ACCEPTING, не тот формат, не та тема, вне расписания, отсутствие в presence', async () => {
    const ok = await acceptingExpert(PH1, {
      topics: ['anxiety-stress'],
      formats: ['video'],
    });
    await acceptingExpert(PH2, {
      topics: ['burnout'],
      formats: ['video'],
    });
    const off = await acceptingExpert(PH3, {
      topics: ['anxiety-stress'],
      formats: ['video'],
    });
    await redis.srem('experts:available', off.expertId);
    const sch = await acceptingExpert(PH4, {
      topics: ['anxiety-stress'],
      formats: ['video'],
    });
    await putScheduleAllDisabled(sch.accessToken);

    const ids = await matching.findCandidates({
      topicSlug: 'anxiety-stress',
      format: 'video',
    });
    expect(ids).toContain(ok.expertId);
    expect(ids).not.toContain(off.expertId);
    expect(ids).not.toContain(sch.expertId);
  });

  it('скоринг: эксперт с историей отказов ниже принимающего; excludeExpertIds работает', async () => {
    const base = { topics: ['anxiety-stress'], formats: ['video'] };
    const good = await acceptingExpert(PH5, base);
    const bad = await acceptingExpert(PH6, base);
    await seedCandidateHistory(good.expertId, { accepted: 8, declined: 2 });
    await seedCandidateHistory(bad.expertId, { accepted: 1, timeout: 9 });

    const ids = await matching.findCandidates({
      topicSlug: 'anxiety-stress',
      format: 'video',
    });
    expect(ids.indexOf(good.expertId)).toBeLessThan(ids.indexOf(bad.expertId));

    const excl = await matching.findCandidates({
      topicSlug: 'anxiety-stress',
      format: 'video',
      excludeExpertIds: [good.expertId],
    });
    expect(excl).not.toContain(good.expertId);
  });

  it('tie-break при равном score: меньше офферов за сегодня — выше; вчерашние офферы не считаются', async () => {
    const base = { topics: ['anxiety-stress'], formats: ['video'] };
    // score у всех троих одинаковый: PENDING-офферы не входят в окно
    // скоринга (только ACCEPTED/DECLINED/TIMEOUT) -> у всех «без истории» 0.5.
    const fresh = await acceptingExpert(PH1, base); // 0 офферов
    const busyToday = await acceptingExpert(PH2, base); // 3 оффера сегодня
    const busyYesterday = await acceptingExpert(PH3, base); // 3 оффера вчера

    await seedCandidateHistory(busyToday.expertId, { pending: 3 });
    await seedCandidateHistory(
      busyYesterday.expertId,
      { pending: 3 },
      { offeredAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    );

    const ids = await matching.findCandidates({
      topicSlug: 'anxiety-stress',
      format: 'video',
    });
    // Эксперт с сегодняшними офферами — последний; вчерашние офферы
    // в tie-break не участвуют (busyYesterday наравне с fresh, выше busyToday).
    expect(ids.indexOf(fresh.expertId)).toBeLessThan(
      ids.indexOf(busyToday.expertId),
    );
    expect(ids.indexOf(busyYesterday.expertId)).toBeLessThan(
      ids.indexOf(busyToday.expertId),
    );
  });

  it('speed-компонента: при равном acceptRate быстрый эксперт выше медленного', async () => {
    const base = { topics: ['anxiety-stress'], formats: ['video'] };
    const fast = await acceptingExpert(PH5, base);
    const slow = await acceptingExpert(PH6, base);
    // acceptRate одинаковый (5/10); разница только в скорости ответа:
    // fast avg 0с -> speed 1; slow avg 40с -> speed = 1 - 40/45 ≈ 0.11.
    await seedCandidateHistory(fast.expertId, { accepted: 5, declined: 5 });
    await seedCandidateHistory(
      slow.expertId,
      { accepted: 5, declined: 5 },
      { responseDelaySec: 40 },
    );

    const ids = await matching.findCandidates({
      topicSlug: 'anxiety-stress',
      format: 'video',
    });
    expect(ids.indexOf(fast.expertId)).toBeLessThan(ids.indexOf(slow.expertId));
  });

  it('urgentOnly: эксперт с acceptsUrgent=false отфильтрован', async () => {
    const base = { topics: ['anxiety-stress'], formats: ['video'] };
    const notUrgent = await acceptingExpert(PH1, base); // acceptsUrgent по умолчанию false

    const ids = await matching.findCandidates({
      topicSlug: 'anxiety-stress',
      format: 'video',
      urgentOnly: true,
    });
    expect(ids).not.toContain(notUrgent.expertId);
  });
});
