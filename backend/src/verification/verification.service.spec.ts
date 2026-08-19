import { VerificationService } from './verification.service';
import { PresenceService } from '../presence/presence.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { RedisService } from '../redis/redis.service';
import { ClockService } from '../common/clock/clock.service';

const EXPERT_ID = 'exp-block-resilience-test';

describe('VerificationService.block — устойчивость к сбою Redis', () => {
  it('block завершается успешно даже при падении presence.setUnavailable', async () => {
    const expert = { id: EXPERT_ID, isBlocked: false };
    const updated = { ...expert, isBlocked: true, blockedReason: 'test' };
    const prisma = {
      expert: {
        findUnique: jest.fn().mockResolvedValue(expert),
        update: jest.fn().mockResolvedValue(updated),
      },
    };
    const audit = { log: jest.fn() };
    const presence = new PresenceService(
      {} as RedisService,
      new ClockService(),
    );
    jest
      .spyOn(presence, 'setUnavailable')
      .mockRejectedValue(new Error('redis down'));

    const service = new VerificationService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      {} as StorageService,
      presence,
    );

    // Блокировка в БД сохранилась и вернулась админу несмотря на сбой Redis.
    await expect(service.block(EXPERT_ID, { reason: 'test' })).resolves.toEqual(
      updated,
    );
    expect(prisma.expert.update).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ transition: 'expert.blocked' }),
    );
  });
});
