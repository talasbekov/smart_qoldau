import {
  ConsultationOutcome,
  ConsultationStatus,
  PrismaClient,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConsultationNoShowObservationService } from './consultation-no-show-observation.service';

// Explicit opt-in only: never use DATABASE_URL or a shared application schema.
// Run with --testRegex 'consultation-no-show-observation.pg-spec.ts$'.
const url = process.env.QOLDAU_NOSHOW_OBSERVATION_PG_URL;
if (
  !url ||
  !/^postgresql:\/\/e30_noshow_a71c:e30_synthetic_a71c@127\.0\.0\.1:\d+\/e30_noshow_a71c$/.test(
    url,
  )
) {
  throw new Error(
    'An explicit disposable E30 no-show PostgreSQL fixture URL is required',
  );
}

const writer = new PrismaClient({ datasources: { db: { url } } });
const reader = new PrismaClient({
  datasources: {
    db: { url: `${url}?options=-c%20default_transaction_read_only%3Don` },
  },
});
const service = new ConsultationNoShowObservationService(
  reader as PrismaService,
  { now: () => new Date('2026-09-17T12:00:00.000Z') },
);
const WINDOW = {
  from: '2026-09-17T10:00:00Z',
  to: '2026-09-17T11:00:00Z',
};

async function addConsultation(
  id: string,
  status: ConsultationStatus,
  outcome: ConsultationOutcome | null,
  endedAt: string | null,
  noShowNotifiedAt: string | null = null,
) {
  await writer.$executeRaw`
    INSERT INTO consultations (
      id, status, outcome, started_at, ended_at, no_show_notified_at
    ) VALUES (
      ${id},
      ${status}::"ConsultationStatus",
      CASE WHEN ${outcome}::text IS NULL THEN NULL
        ELSE ${outcome}::"ConsultationOutcome" END,
      timestamp '2026-09-17 09:00:00',
      CASE WHEN ${endedAt}::text IS NULL THEN NULL
        ELSE (${endedAt}::timestamptz AT TIME ZONE 'UTC') END,
      CASE WHEN ${noShowNotifiedAt}::text IS NULL THEN NULL
        ELSE (${noShowNotifiedAt}::timestamptz AT TIME ZONE 'UTC') END
    )
  `;
}

describe('Consultation no-show exact query on disposable PostgreSQL 16', () => {
  beforeAll(async () => {
    const version = await writer.$queryRaw<{ server_version: string }[]>`
      SHOW server_version
    `;
    expect(version[0].server_version).toMatch(/^16\./);
    await writer.$executeRawUnsafe(`
      CREATE TYPE "ConsultationStatus" AS ENUM (
        'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED'
      )
    `);
    await writer.$executeRawUnsafe(`
      CREATE TYPE "ConsultationOutcome" AS ENUM (
        'COMPLETED', 'CLIENT_NO_SHOW', 'CLIENT_CANCELLED',
        'TECH_ISSUE', 'EXPERT_CANCELLED'
      )
    `);
    await writer.$executeRawUnsafe(`
      CREATE TABLE consultations (
        id text PRIMARY KEY,
        status "ConsultationStatus" NOT NULL,
        outcome "ConsultationOutcome",
        started_at timestamp(3) NOT NULL,
        ended_at timestamp(3),
        no_show_notified_at timestamp(3)
      )
    `);
    const readOnly = await reader.$queryRaw<
      { default_transaction_read_only: string }[]
    >`SHOW default_transaction_read_only`;
    expect(readOnly[0].default_transaction_read_only).toBe('on');
  });

  beforeEach(async () => {
    await writer.$executeRawUnsafe('TRUNCATE consultations');
  });

  afterAll(async () => {
    await Promise.all([reader.$disconnect(), writer.$disconnect()]);
  });

  it('returns zero raw counts for an empty statement snapshot', async () => {
    await expect(service.observe(WINDOW)).resolves.toEqual({
      signal: 'consultation.client_no_show_observation',
      state: 'observed',
      window: WINDOW,
      observedAt: '2026-09-17T12:00:00.000Z',
      cohortCompletedCount: 0,
      clientNoShowOutcomeCount: 0,
      outcomeCounts: {
        COMPLETED: 0,
        CLIENT_CANCELLED: 0,
        TECH_ISSUE: 0,
        EXPERT_CANCELLED: 0,
      },
      completedWithoutOutcomeCount: 0,
      completedWithoutEndedAtCountAllTime: 0,
    });
  });

  it('buckets every outcome enum and NULL exactly once', async () => {
    await addConsultation(
      'client-no-show',
      ConsultationStatus.COMPLETED,
      ConsultationOutcome.CLIENT_NO_SHOW,
      '2026-09-17T10:10:00Z',
    );
    await addConsultation(
      'completed',
      ConsultationStatus.COMPLETED,
      ConsultationOutcome.COMPLETED,
      '2026-09-17T10:20:00Z',
    );
    await addConsultation(
      'client-cancelled',
      ConsultationStatus.COMPLETED,
      ConsultationOutcome.CLIENT_CANCELLED,
      '2026-09-17T10:30:00Z',
    );
    await addConsultation(
      'tech-issue',
      ConsultationStatus.COMPLETED,
      ConsultationOutcome.TECH_ISSUE,
      '2026-09-17T10:40:00Z',
    );
    await addConsultation(
      'expert-cancelled',
      ConsultationStatus.COMPLETED,
      ConsultationOutcome.EXPERT_CANCELLED,
      '2026-09-17T10:50:00Z',
    );
    await addConsultation(
      'null-outcome',
      ConsultationStatus.COMPLETED,
      null,
      '2026-09-17T10:55:00Z',
    );

    await expect(service.observe(WINDOW)).resolves.toMatchObject({
      cohortCompletedCount: 6,
      clientNoShowOutcomeCount: 1,
      outcomeCounts: {
        COMPLETED: 1,
        CLIENT_CANCELLED: 1,
        TECH_ISSUE: 1,
        EXPERT_CANCELLED: 1,
      },
      completedWithoutOutcomeCount: 1,
    });
  });

  it('uses a half-open endedAt cohort and excludes non-COMPLETED status', async () => {
    await addConsultation(
      'at-from',
      ConsultationStatus.COMPLETED,
      ConsultationOutcome.CLIENT_NO_SHOW,
      '2026-09-17T10:00:00Z',
    );
    await addConsultation(
      'before-to',
      ConsultationStatus.COMPLETED,
      ConsultationOutcome.COMPLETED,
      '2026-09-17T10:59:59.999Z',
    );
    await addConsultation(
      'at-to',
      ConsultationStatus.COMPLETED,
      ConsultationOutcome.CLIENT_NO_SHOW,
      '2026-09-17T11:00:00Z',
    );
    await addConsultation(
      'before-from',
      ConsultationStatus.COMPLETED,
      ConsultationOutcome.CLIENT_NO_SHOW,
      '2026-09-17T09:59:59.999Z',
    );
    await addConsultation(
      'cancelled-status',
      ConsultationStatus.CANCELLED,
      ConsultationOutcome.CLIENT_NO_SHOW,
      '2026-09-17T10:30:00Z',
    );
    await addConsultation(
      'scheduled-status',
      ConsultationStatus.SCHEDULED,
      ConsultationOutcome.CLIENT_NO_SHOW,
      '2026-09-17T10:35:00Z',
    );
    await addConsultation(
      'active-status',
      ConsultationStatus.ACTIVE,
      ConsultationOutcome.CLIENT_NO_SHOW,
      '2026-09-17T10:40:00Z',
    );

    await expect(service.observe(WINDOW)).resolves.toMatchObject({
      cohortCompletedCount: 2,
      clientNoShowOutcomeCount: 1,
      outcomeCounts: { COMPLETED: 1 },
    });
  });

  it('excludes hint-only rows and buckets a late outcome by recorded endedAt', async () => {
    await addConsultation(
      'hint-only-active',
      ConsultationStatus.ACTIVE,
      null,
      null,
      '2026-09-17T10:15:00Z',
    );
    await addConsultation(
      'late-recorded-outcome',
      ConsultationStatus.COMPLETED,
      ConsultationOutcome.CLIENT_NO_SHOW,
      '2026-09-17T10:45:00Z',
      '2026-09-17T09:30:00Z',
    );

    await expect(service.observe(WINDOW)).resolves.toMatchObject({
      cohortCompletedCount: 1,
      clientNoShowOutcomeCount: 1,
      completedWithoutOutcomeCount: 0,
      completedWithoutEndedAtCountAllTime: 0,
    });
  });

  it('keeps all-time COMPLETED rows without endedAt outside the window cohort', async () => {
    await addConsultation(
      'missing-ended-client-no-show',
      ConsultationStatus.COMPLETED,
      ConsultationOutcome.CLIENT_NO_SHOW,
      null,
    );
    await addConsultation(
      'missing-ended-null-outcome',
      ConsultationStatus.COMPLETED,
      null,
      null,
    );
    await addConsultation(
      'active-missing-ended',
      ConsultationStatus.ACTIVE,
      null,
      null,
    );

    await expect(service.observe(WINDOW)).resolves.toMatchObject({
      cohortCompletedCount: 0,
      clientNoShowOutcomeCount: 0,
      completedWithoutOutcomeCount: 0,
      completedWithoutEndedAtCountAllTime: 2,
    });
  });

  it('returns the full raw cohort in one SELECT without a row cap', async () => {
    await writer.$executeRaw`
      INSERT INTO consultations (
        id, status, outcome, started_at, ended_at
      )
      SELECT
        'bulk-' || n,
        'COMPLETED'::"ConsultationStatus",
        'CLIENT_NO_SHOW'::"ConsultationOutcome",
        timestamp '2026-09-17 09:00:00',
        timestamp '2026-09-17 10:30:00'
      FROM generate_series(1, 151) n
    `;
    const query = jest.spyOn(reader, '$queryRaw');
    try {
      await expect(service.observe(WINDOW)).resolves.toMatchObject({
        cohortCompletedCount: 151,
        clientNoShowOutcomeCount: 151,
      });
      expect(query).toHaveBeenCalledTimes(1);
    } finally {
      query.mockRestore();
    }
  });

  it('propagates a database error instead of returning observed state', async () => {
    await writer.$executeRawUnsafe(
      'ALTER TABLE consultations RENAME TO unavailable_consultations',
    );
    try {
      await expect(service.observe(WINDOW)).rejects.toThrow();
    } finally {
      await writer.$executeRawUnsafe(
        'ALTER TABLE unavailable_consultations RENAME TO consultations',
      );
    }
  });
});
