import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { PrismaService } from '../prisma/prisma.service';
import { RetentionSweepService } from './retention-sweep.service';

// Юнит на моках: проверяется пакетность удаления. Единовременный
// deleteMany на выросшей таблице держит блокировку долго и мешает боевым
// запросам — поэтому уборка идёт пачками.
describe('RetentionSweepService', () => {
  let service: RetentionSweepService;
  let notificationsLeft: number;
  let deleteCalls: number;

  beforeEach(async () => {
    notificationsLeft = 2500;
    deleteCalls = 0;

    const prisma = {
      providerEvent: {
        findMany: async () => [],
        deleteMany: async () => ({ count: 0 }),
      },
      notification: {
        findMany: async ({ take }: { take: number }) => {
          const size = Math.min(take, notificationsLeft);
          return Array.from({ length: size }, (_, i) => ({ id: `n-${i}` }));
        },
        deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
          deleteCalls++;
          const count = where.id.in.length;
          notificationsLeft -= count;
          return { count };
        },
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RetentionSweepService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ClockService,
          useValue: { now: () => new Date('2026-08-23T05:00:00Z') },
        },
        { provide: AuditService, useValue: { log: async () => {} } },
        {
          provide: ConfigService,
          useValue: { get: (_key: string, fallback?: string) => fallback },
        },
      ],
    }).compile();
    service = moduleRef.get(RetentionSweepService);
  });

  it('2500 записей удаляются тремя пачками по 1000, а не одной операцией', async () => {
    const summary = await service.sweep();

    expect(summary.notifications).toBe(2500);
    expect(deleteCalls).toBe(3);
  });

  it('пустая выборка не приводит к лишнему удалению', async () => {
    notificationsLeft = 0;

    const summary = await service.sweep();

    expect(summary.notifications).toBe(0);
    expect(deleteCalls).toBe(0);
  });
});
