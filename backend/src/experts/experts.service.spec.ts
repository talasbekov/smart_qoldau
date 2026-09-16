import { Expert, VerificationStatus, WorkStatus } from '@prisma/client';
import { ExpertsService } from './experts.service';
import { PresenceService } from '../presence/presence.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';

const EXPERT_ID = 'exp-compensation-test';

function makeExpert(workStatus: WorkStatus): Expert {
  return {
    id: EXPERT_ID,
    userId: 'user-compensation-test',
    verificationStatus: VerificationStatus.VERIFIED,
    workStatus,
    isBlocked: false,
  } as Expert;
}

describe('ExpertsService.updateWorkStatus — компенсация presence при сбое БД', () => {
  let redis: RedisService;
  let presence: PresenceService;
  let prisma: {
    $executeRaw: jest.Mock;
    expert: { update: jest.Mock; findUnique: jest.Mock };
  };
  let service: ExpertsService;

  beforeAll(() => {
    redis = new RedisService({
      getOrThrow: () => process.env.REDIS_URL ?? 'redis://localhost:6379',
    } as never);
    presence = new PresenceService(redis, new ClockService());
  });

  beforeEach(() => {
    prisma = {
      $executeRaw: jest.fn(),
      expert: {
        update: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({
          ...makeExpert(WorkStatus.ACCEPTING),
          topics: [],
        }),
      },
    };
    service = new ExpertsService(
      prisma as unknown as PrismaService,
      { log: jest.fn() } as unknown as AuditService,
      presence,
      {} as never,
      {} as never,
    );
  });

  afterEach(() => redis.srem('experts:available', EXPERT_ID));

  afterAll(() => redis.quit());

  it('сбой БД при ACCEPTING: presence откатывается (эксперт удалён), ошибка проброшена', async () => {
    const dbError = new Error('db down');
    prisma.$executeRaw.mockRejectedValue(dbError);

    await expect(
      service.updateWorkStatus(makeExpert(WorkStatus.NOT_ACCEPTING), {
        workStatus: WorkStatus.ACCEPTING,
      }),
    ).rejects.toThrow(dbError);

    expect(await presence.isAvailable(EXPERT_ID)).toBe(false);
  });

  it('не переводит эксперта в ACCEPTING при активной консультации', async () => {
    prisma.$executeRaw.mockResolvedValue(0);

    await expect(
      service.updateWorkStatus(makeExpert(WorkStatus.BUSY), {
        workStatus: WorkStatus.ACCEPTING,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'EXPERT_BUSY' }),
      status: 409,
    });

    expect(prisma.expert.update).not.toHaveBeenCalled();
    expect(await presence.isAvailable(EXPERT_ID)).toBe(false);
  });

  it('не перезаписывает BUSY в NOT_ACCEPTING при активной консультации', async () => {
    prisma.$executeRaw.mockResolvedValue(0);

    await expect(
      service.updateWorkStatus(makeExpert(WorkStatus.BUSY), {
        workStatus: WorkStatus.NOT_ACCEPTING,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'EXPERT_BUSY' }),
      status: 409,
    });

    expect(prisma.expert.update).not.toHaveBeenCalled();
    expect(await presence.isAvailable(EXPERT_ID)).toBe(false);
  });

  it('сбой БД при уходе из ACCEPTING: эксперт возвращён в presence, ошибка проброшена', async () => {
    await presence.setAvailable(EXPERT_ID);
    const dbError = new Error('db down');
    prisma.$executeRaw.mockRejectedValue(dbError);

    await expect(
      service.updateWorkStatus(makeExpert(WorkStatus.ACCEPTING), {
        workStatus: WorkStatus.NOT_ACCEPTING,
      }),
    ).rejects.toThrow(dbError);

    expect(await presence.isAvailable(EXPERT_ID)).toBe(true);
  });
});
