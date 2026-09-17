import {
  ConsultationStatus,
  PaymentStatus,
  PrismaClient,
} from '@prisma/client';
import { PaymentOperationalSignalService } from './payment-operational-signal.service';
import { PrismaService } from '../prisma/prisma.service';

// Explicit opt-in only: never use DATABASE_URL or a shared application schema.
// Run with --testRegex 'payment-operational-signal.pg-spec.ts$'.
const url = process.env.QOLDAU_SETTLE_TEST_PG_URL;
if (
  !url ||
  !/^postgresql:\/\/e30_settle_76ef:e30_synthetic_only@127\.0\.0\.1:\d+\/e30_settle_76ef$/.test(
    url,
  )
) {
  throw new Error(
    'An explicit disposable E30 PostgreSQL fixture URL is required',
  );
}
const prisma = new PrismaClient({ datasources: { db: { url } } });
const reader = new PrismaClient({
  datasources: {
    db: { url: `${url}?options=-c%20default_transaction_read_only%3Don` },
  },
});
const service = new PaymentOperationalSignalService(reader as PrismaService, {
  now: () => new Date('2026-09-17T12:00:00.900Z'),
});

async function add(
  id: string,
  paymentStatus: PaymentStatus,
  attempts: number,
  consultationStatus: ConsultationStatus | null,
) {
  if (consultationStatus !== null) {
    await prisma.$executeRaw`INSERT INTO consultations (id, status)
      VALUES (${id}, CAST(${consultationStatus} AS "ConsultationStatus"))`;
  }
  await prisma.$executeRaw`INSERT INTO payments (id, consultation_id, status, settle_attempts)
    VALUES (${id}, ${id}, CAST(${paymentStatus} AS "PaymentStatus"), ${attempts})`;
}

async function expectSignal(e: number, x: number, state: string) {
  await expect(service.operationalSignal()).resolves.toEqual({
    signal: 'payment.settle_exhausted',
    state,
    maxAttempts: 10,
    currentExhaustedCount: e,
    unexpectedContextCount: x,
    providerOutcome: 'not_determined_by_source',
    observedAt: '2026-09-17T12:00:00.900Z',
  });
}

describe('Payment signal exact query on disposable PostgreSQL 16', () => {
  beforeAll(async () => {
    const version = await prisma.$queryRaw<
      { server_version: string }[]
    >`SHOW server_version`;
    expect(version[0].server_version).toMatch(/^16\./);
    await prisma.$executeRawUnsafe(
      `CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'HELD', 'CAPTURED', 'VOIDED', 'FAILED')`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TYPE "ConsultationStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED')`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TABLE consultations (id text PRIMARY KEY, status "ConsultationStatus" NOT NULL, payment_status text DEFAULT 'UNPAID')`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TABLE payments (id text PRIMARY KEY, consultation_id text UNIQUE NOT NULL, status "PaymentStatus" NOT NULL, settle_attempts integer NOT NULL, last_settle_attempt_at timestamp NULL, provider_hold_id text NULL)`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TABLE audit_logs (entity_id text, transition text, created_at timestamp)`,
    );
    const readOnly = await reader.$queryRaw<
      { default_transaction_read_only: string }[]
    >`SHOW default_transaction_read_only`;
    expect(readOnly[0].default_transaction_read_only).toBe('on');
  });
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE payments, consultations, audit_logs',
    );
  });
  afterAll(async () => {
    await Promise.all([reader.$disconnect(), prisma.$disconnect()]);
  });

  it('returns an empty snapshot as ok without claiming a provider outcome', async () => {
    await expectSignal(0, 0, 'ok');
  });
  it.each([
    [ConsultationStatus.COMPLETED, 9, 0, 'ok'],
    [ConsultationStatus.COMPLETED, 10, 1, 'alerting'],
    [ConsultationStatus.COMPLETED, 11, 1, 'alerting'],
    [ConsultationStatus.CANCELLED, 9, 0, 'ok'],
    [ConsultationStatus.CANCELLED, 10, 1, 'alerting'],
    [ConsultationStatus.CANCELLED, 11, 1, 'alerting'],
  ])(
    'HELD with %s at %i attempts counts E=%i',
    async (status, attempts, e, state) => {
      await add('terminal', PaymentStatus.HELD, attempts, status);
      await expectSignal(e, 0, state);
    },
  );
  it.each([
    PaymentStatus.PENDING,
    PaymentStatus.CAPTURED,
    PaymentStatus.VOIDED,
    PaymentStatus.FAILED,
  ])(
    'excludes %s at/above the limit in terminal, active, and missing contexts',
    async (status) => {
      await add('completed', status, 10, ConsultationStatus.COMPLETED);
      await add('cancelled', status, 11, ConsultationStatus.CANCELLED);
      await add('active', status, 11, ConsultationStatus.ACTIVE);
      await add('scheduled', status, 10, ConsultationStatus.SCHEDULED);
      await add('missing', status, 11, null);
      await prisma.$executeRaw`INSERT INTO audit_logs VALUES ('completed', 'payment.settle_exhausted', '2020-01-01')`;
      await expectSignal(0, 0, 'ok');
    },
  );
  it.each([ConsultationStatus.ACTIVE, ConsultationStatus.SCHEDULED, null])(
    'classifies HELD %s as unexpected only at/above the limit',
    async (status) => {
      await add('below', PaymentStatus.HELD, 9, status);
      await expectSignal(0, 0, 'ok');
      await add('limit', PaymentStatus.HELD, 10, status);
      await add('above', PaymentStatus.HELD, 12, status);
      await expectSignal(0, 2, 'unknown');
    },
  );
  it('prioritizes E over X and counts more than the sweep batch in one SELECT', async () => {
    await prisma.$executeRaw`INSERT INTO consultations (id, status)
      SELECT 'terminal-' || n, 'COMPLETED'::"ConsultationStatus" FROM generate_series(1, 151) n`;
    await prisma.$executeRaw`INSERT INTO payments (id, consultation_id, status, settle_attempts)
      SELECT 'terminal-' || n, 'terminal-' || n, 'HELD'::"PaymentStatus", 10 FROM generate_series(1, 151) n`;
    await prisma.$executeRaw`INSERT INTO payments (id, consultation_id, status, settle_attempts)
      SELECT 'missing-' || n, 'missing-' || n, 'HELD'::"PaymentStatus", 12 FROM generate_series(1, 121) n`;
    const query = jest.spyOn(reader, '$queryRaw');
    try {
      await expectSignal(151, 121, 'alerting');
      expect(query).toHaveBeenCalledTimes(1);
    } finally {
      query.mockRestore();
    }
  });
  it('ignores absent/duplicate/old audit, NULL timestamps/hold id and inconsistent payment mirror', async () => {
    await add(
      'exhausted',
      PaymentStatus.HELD,
      10,
      ConsultationStatus.COMPLETED,
    );
    await expectSignal(1, 0, 'alerting');
    await prisma.$executeRaw`INSERT INTO audit_logs VALUES
      ('exhausted', 'payment.settle_exhausted', '2020-01-01'),
      ('exhausted', 'payment.settle_exhausted', '2020-01-01')`;
    await expectSignal(1, 0, 'alerting');
    await prisma.$executeRaw`UPDATE payments SET last_settle_attempt_at = '2099-01-01'`;
    await expectSignal(1, 0, 'alerting');
  });
  it('uses current status with retained attempts and never infers financial resolution', async () => {
    await add('retained', PaymentStatus.HELD, 11, ConsultationStatus.COMPLETED);
    await expectSignal(1, 0, 'alerting');
    await prisma.$executeRaw`UPDATE payments SET status = 'FAILED'`;
    await expectSignal(0, 0, 'ok');
    await prisma.$executeRaw`UPDATE payments SET status = 'HELD'`;
    await expectSignal(1, 0, 'alerting');
  });
  it('rejects query errors rather than emitting zeros/ok', async () => {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE payments RENAME TO unavailable_payments',
    );
    try {
      await expect(service.operationalSignal()).rejects.toThrow();
    } finally {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE unavailable_payments RENAME TO payments',
      );
    }
  });
});
