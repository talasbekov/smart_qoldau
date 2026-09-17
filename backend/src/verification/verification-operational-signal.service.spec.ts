import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { VerificationService } from './verification.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { PresenceService } from '../presence/presence.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ClockService } from '../common/clock/clock.service';

describe('VerificationService operational signal', () => {
  const observedAt = new Date('2026-09-17T12:00:00.900Z');
  const prisma = { $queryRaw: jest.fn() };
  const storage = {
    getSignedDownloadUrl: jest.fn(),
    avatarUrl: jest.fn(),
  };
  const clock = { now: jest.fn(() => new Date(observedAt)) };
  type ServiceWithOperationalSignal = VerificationService & {
    operationalSignal(): Promise<{
      oldestPendingAgeSeconds: number | null;
      state: string;
    }>;
  };
  let service: ServiceWithOperationalSignal;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        VerificationService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: { log: jest.fn() } },
        { provide: StorageService, useValue: storage },
        { provide: PresenceService, useValue: { setUnavailable: jest.fn() } },
        {
          provide: NotificationsService,
          useValue: { dispatch: jest.fn() },
        },
        { provide: ClockService, useValue: clock },
      ],
    }).compile();
    service = moduleRef.get(
      VerificationService,
    ) as ServiceWithOperationalSignal;
  });

  it('uses one aggregate with < cutoff so only before 24h is overdue, not exact/after, and excludes non-PENDING', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        overdueCount: 2,
        missingSubmittedAtCount: 1,
        oldestPendingSubmittedAt: new Date('2026-09-16T10:59:59.100Z'),
      },
    ]);

    await expect(service.operationalSignal()).resolves.toEqual({
      signal: 'verification.queue_over_24h',
      state: 'alerting',
      thresholdHours: 24,
      overdueCount: 2,
      oldestPendingAgeSeconds: 90001,
      missingSubmittedAtCount: 1,
      observedAt: '2026-09-17T12:00:00.900Z',
    });

    expect(clock.now).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    const query = prisma.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    const normalizedSql = query.sql.replace(/\s+/g, ' ').trim();
    expect(normalizedSql).toContain('verification_submitted_at < ?');
    expect(normalizedSql).not.toContain('verification_submitted_at <= ?');
    expect(normalizedSql).toContain(
      'verification_status = CAST( ? AS "VerificationStatus" )',
    );
    expect(query.values).toEqual([
      new Date('2026-09-16T12:00:00.900Z'),
      'PENDING',
    ]);
    expect(query.sql).toContain('COUNT(*) FILTER');
    expect(query.sql).toContain('MIN(verification_submitted_at) FILTER');
  });

  it('returns ok with null age when no PENDING row has a submitted timestamp', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        overdueCount: 0,
        missingSubmittedAtCount: 3,
        oldestPendingSubmittedAt: null,
      },
    ]);

    await expect(service.operationalSignal()).resolves.toEqual({
      signal: 'verification.queue_over_24h',
      state: 'ok',
      thresholdHours: 24,
      overdueCount: 0,
      oldestPendingAgeSeconds: null,
      missingSubmittedAtCount: 3,
      observedAt: '2026-09-17T12:00:00.900Z',
    });
  });

  it('returns zero counts and null age for an empty PENDING queue', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        overdueCount: 0,
        missingSubmittedAtCount: 0,
        oldestPendingSubmittedAt: null,
      },
    ]);

    await expect(service.operationalSignal()).resolves.toMatchObject({
      state: 'ok',
      overdueCount: 0,
      oldestPendingAgeSeconds: null,
      missingSubmittedAtCount: 0,
    });
  });

  it('floors age seconds and clamps a future submitted timestamp to zero', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        overdueCount: 0,
        missingSubmittedAtCount: 0,
        oldestPendingSubmittedAt: new Date('2026-09-17T12:00:01.100Z'),
      },
    ]);

    const result = await service.operationalSignal();

    expect(result.oldestPendingAgeSeconds).toBe(0);
    expect(result.state).toBe('ok');
  });

  it('does not select queue rows, documents, PII, or signed URLs', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        overdueCount: 0,
        missingSubmittedAtCount: 0,
        oldestPendingSubmittedAt: null,
      },
    ]);

    await service.operationalSignal();

    const query = prisma.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    expect(query.sql.trimStart()).toMatch(/^SELECT\s/i);
    expect(query.sql).not.toMatch(
      /\bid\b|user_id|display_name|expert_documents|file_key/i,
    );
    expect(storage.getSignedDownloadUrl).not.toHaveBeenCalled();
  });

  it('propagates database failures instead of returning ok', async () => {
    const databaseError = new Error('database unavailable');
    prisma.$queryRaw.mockRejectedValue(databaseError);

    await expect(service.operationalSignal()).rejects.toBe(databaseError);
  });
});
