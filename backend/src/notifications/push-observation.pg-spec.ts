import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushObservationService } from './push-observation.service';

// Explicit opt-in only: never use DATABASE_URL or a shared application schema.
// Run with --testRegex 'push-observation.pg-spec.ts$'.
const url = process.env.QOLDAU_PUSH_OBSERVATION_PG_URL;
if (
  !url ||
  !/^postgresql:\/\/e30_push_8d63:e30_synthetic_8d63@127\.0\.0\.1:\d+\/e30_push_8d63$/.test(
    url,
  )
) {
  throw new Error(
    'An explicit disposable E30 push PostgreSQL fixture URL is required',
  );
}

const writer = new PrismaClient({ datasources: { db: { url } } });
const reader = new PrismaClient({
  datasources: {
    db: { url: `${url}?options=-c%20default_transaction_read_only%3Don` },
  },
});
const service = new PushObservationService(reader as PrismaService, {
  now: () => new Date('2026-09-17T12:00:00.000Z'),
});
const WINDOW = {
  from: '2026-09-17T10:00:00Z',
  to: '2026-09-17T11:00:00Z',
};

async function addNotification(
  id: string,
  pushSentAt: string | null,
  pushDeliveredAt: string | null = null,
  type = 'offer.incoming',
) {
  await writer.$executeRaw`
    INSERT INTO notifications (id, type, push_sent_at, push_delivered_at)
    VALUES (
      ${id},
      ${type},
      CASE WHEN ${pushSentAt}::text IS NULL THEN NULL
        ELSE (${pushSentAt}::timestamptz AT TIME ZONE 'UTC') END,
      CASE WHEN ${pushDeliveredAt}::text IS NULL THEN NULL
        ELSE (${pushDeliveredAt}::timestamptz AT TIME ZONE 'UTC') END
    )
  `;
}

async function addOutbox(
  id: string,
  notificationId: string,
  sentAt: string | null,
  deadAt: string | null,
  type = 'offer.incoming',
) {
  await writer.$executeRaw`
    INSERT INTO notification_outbox (
      id, notification_id, type, sent_at, dead_at
    ) VALUES (
      ${id},
      ${notificationId},
      ${type},
      CASE WHEN ${sentAt}::text IS NULL THEN NULL
        ELSE (${sentAt}::timestamptz AT TIME ZONE 'UTC') END,
      CASE WHEN ${deadAt}::text IS NULL THEN NULL
        ELSE (${deadAt}::timestamptz AT TIME ZONE 'UTC') END
    )
  `;
}

describe('Push observation exact query on disposable PostgreSQL 16', () => {
  beforeAll(async () => {
    const version = await writer.$queryRaw<{ server_version: string }[]>`
      SHOW server_version
    `;
    expect(version[0].server_version).toMatch(/^16\./);
    await writer.$executeRawUnsafe(`
      CREATE TABLE notifications (
        id text PRIMARY KEY,
        type text NOT NULL,
        push_sent_at timestamp(3),
        push_delivered_at timestamp(3)
      )
    `);
    await writer.$executeRawUnsafe(`
      CREATE TABLE notification_outbox (
        id text PRIMARY KEY,
        notification_id text NOT NULL,
        type text NOT NULL,
        sent_at timestamp(3),
        dead_at timestamp(3)
      )
    `);
    const readOnly = await reader.$queryRaw<
      { default_transaction_read_only: string }[]
    >`SHOW default_transaction_read_only`;
    expect(readOnly[0].default_transaction_read_only).toBe('on');
  });

  beforeEach(async () => {
    await writer.$executeRawUnsafe(
      'TRUNCATE notification_outbox, notifications',
    );
  });

  afterAll(async () => {
    await Promise.all([reader.$disconnect(), writer.$disconnect()]);
  });

  it('returns zero counts and null p95 for an empty snapshot', async () => {
    await expect(service.observe(WINDOW)).resolves.toMatchObject({
      completedFanoutCount: 0,
      deviceAckCount: 0,
      unacknowledgedCount: 0,
      latencySampleCount: 0,
      negativeLatencyCount: 0,
      ackLatencyP95Ms: null,
      outboxDeadCount: 0,
      closedWithoutRecordedFanoutCount: 0,
      missingNotificationForClosedOutboxCount: 0,
    });
  });

  it('uses a half-open send cohort and counts late acknowledgements', async () => {
    await addNotification(
      'at-from-late-ack',
      '2026-09-17T10:00:00Z',
      '2026-09-17T11:00:03Z',
    );
    await addNotification('before-to-ackless', '2026-09-17T10:59:59.999Z');
    await addNotification(
      'at-to',
      '2026-09-17T11:00:00Z',
      '2026-09-17T11:00:01Z',
    );
    await addNotification(
      'before-from',
      '2026-09-17T09:59:59.999Z',
      '2026-09-17T10:00:01Z',
    );
    await addNotification(
      'wrong-type',
      '2026-09-17T10:30:00Z',
      '2026-09-17T10:30:01Z',
      'ticket.replied',
    );

    await expect(service.observe(WINDOW)).resolves.toMatchObject({
      completedFanoutCount: 2,
      deviceAckCount: 1,
      unacknowledgedCount: 1,
      latencySampleCount: 1,
      negativeLatencyCount: 0,
      ackLatencyP95Ms: 3_603_000,
    });
  });

  it('separates negative latency and uses nearest-rank p95 of valid samples', async () => {
    for (let seconds = 1; seconds <= 20; seconds += 1) {
      await addNotification(
        `latency-${seconds}`,
        '2026-09-17T10:30:00Z',
        `2026-09-17T10:30:${seconds.toString().padStart(2, '0')}Z`,
      );
    }
    await addNotification(
      'negative',
      '2026-09-17T10:30:00Z',
      '2026-09-17T10:29:59Z',
    );
    await addNotification('ackless', '2026-09-17T10:30:00Z');

    await expect(service.observe(WINDOW)).resolves.toMatchObject({
      completedFanoutCount: 22,
      deviceAckCount: 21,
      unacknowledgedCount: 1,
      latencySampleCount: 20,
      negativeLatencyCount: 1,
      ackLatencyP95Ms: 19_000,
    });
  });

  it('returns null p95 when every recorded acknowledgement is negative', async () => {
    await addNotification(
      'negative-only',
      '2026-09-17T10:30:00Z',
      '2026-09-17T10:29:59Z',
    );
    await expect(service.observe(WINDOW)).resolves.toMatchObject({
      completedFanoutCount: 1,
      deviceAckCount: 1,
      unacknowledgedCount: 0,
      latencySampleCount: 0,
      negativeLatencyCount: 1,
      ackLatencyP95Ms: null,
    });
  });

  it('keeps joined dead, closed-without-fanout, and orphan closures independent', async () => {
    await addNotification('cohort', '2026-09-17T10:30:00Z');
    await addNotification('dead-notification', null);
    await addNotification('closed-notification', null);
    await addNotification('fanout-notification', '2026-09-17T09:00:00Z');
    await addNotification(
      'wrong-notification-type',
      null,
      null,
      'ticket.replied',
    );

    await addOutbox('cohort-history-1', 'cohort', '2026-09-17T10:20:00Z', null);
    await addOutbox('cohort-history-2', 'cohort', '2026-09-17T10:21:00Z', null);
    await addOutbox('dead', 'dead-notification', null, '2026-09-17T10:15:00Z');
    await addOutbox(
      'closed',
      'closed-notification',
      '2026-09-17T10:16:00Z',
      null,
    );
    await addOutbox(
      'already-fanout',
      'fanout-notification',
      '2026-09-17T10:17:00Z',
      null,
    );
    await addOutbox(
      'closed-and-dead',
      'closed-notification',
      '2026-09-17T10:18:00Z',
      '2026-09-17T10:19:00Z',
    );
    await addOutbox(
      'orphan',
      'missing-notification',
      '2026-09-17T10:22:00Z',
      '2026-09-17T10:23:00Z',
    );
    await addOutbox(
      'joined-other-notification-type',
      'wrong-notification-type',
      null,
      '2026-09-17T10:24:00Z',
    );
    await addOutbox(
      'wrong-outbox-type',
      'dead-notification',
      '2026-09-17T10:25:00Z',
      '2026-09-17T10:26:00Z',
      'ticket.replied',
    );

    await expect(service.observe(WINDOW)).resolves.toMatchObject({
      completedFanoutCount: 1,
      outboxDeadCount: 3,
      closedWithoutRecordedFanoutCount: 1,
      missingNotificationForClosedOutboxCount: 1,
    });
  });

  it('does not cap or multiply the notification denominator', async () => {
    await writer.$executeRaw`
      INSERT INTO notifications (id, type, push_sent_at)
      SELECT
        'bulk-' || n,
        'offer.incoming',
        timestamp '2026-09-17 10:30:00'
      FROM generate_series(1, 151) n
    `;
    await addOutbox('history-a', 'bulk-1', '2026-09-17T10:31:00Z', null);
    await addOutbox('history-b', 'bulk-1', '2026-09-17T10:32:00Z', null);

    await expect(service.observe(WINDOW)).resolves.toMatchObject({
      completedFanoutCount: 151,
      deviceAckCount: 0,
      unacknowledgedCount: 151,
    });
  });

  it('propagates a database error instead of returning observed state', async () => {
    await writer.$executeRawUnsafe(
      'ALTER TABLE notifications RENAME TO unavailable_notifications',
    );
    try {
      await expect(service.observe(WINDOW)).rejects.toThrow();
    } finally {
      await writer.$executeRawUnsafe(
        'ALTER TABLE unavailable_notifications RENAME TO notifications',
      );
    }
  });
});
