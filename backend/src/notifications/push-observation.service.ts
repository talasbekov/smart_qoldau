import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClockService } from '../common/clock/clock.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushObservationQueryDto } from './dto/push-observation-query.dto';
import { PushObservationDto } from './dto/push-observation.dto';

const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;
const OFFER_TYPE = 'offer.incoming';

type PushObservationAggregate = Pick<
  PushObservationDto,
  | 'completedFanoutCount'
  | 'deviceAckCount'
  | 'unacknowledgedCount'
  | 'latencySampleCount'
  | 'negativeLatencyCount'
  | 'ackLatencyP95Ms'
  | 'outboxDeadCount'
  | 'closedWithoutRecordedFanoutCount'
  | 'missingNotificationForClosedOutboxCount'
>;

const COUNT_FIELDS: (keyof PushObservationAggregate)[] = [
  'completedFanoutCount',
  'deviceAckCount',
  'unacknowledgedCount',
  'latencySampleCount',
  'negativeLatencyCount',
  'outboxDeadCount',
  'closedWithoutRecordedFanoutCount',
  'missingNotificationForClosedOutboxCount',
];

@Injectable()
export class PushObservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  async observe(query: PushObservationQueryDto): Promise<PushObservationDto> {
    const observedAt = this.clock.now();
    const fromMs = Date.parse(query.from);
    const toMs = Date.parse(query.to);
    if (
      !Number.isFinite(fromMs) ||
      !Number.isFinite(toMs) ||
      fromMs >= toMs ||
      toMs > observedAt.getTime() ||
      toMs - fromMs > MAX_WINDOW_MS
    ) {
      throw new BadRequestException('Invalid push observation window');
    }

    // Independent aggregates share one PostgreSQL statement snapshot. Keeping
    // the outbox join outside the notification cohort prevents denominator
    // multiplication when outbox history is duplicated.
    const [aggregate] = await this.prisma.$queryRaw<
      PushObservationAggregate[]
    >(Prisma.sql`
      WITH bounds AS (
        SELECT
          (${query.from}::timestamptz AT TIME ZONE 'UTC') AS from_at,
          (${query.to}::timestamptz AT TIME ZONE 'UTC') AS to_at,
          ${OFFER_TYPE}::text AS notification_type
      ),
      notification_cohort AS (
        SELECT n.push_sent_at, n.push_delivered_at
        FROM notifications n
        CROSS JOIN bounds b
        WHERE n.type = b.notification_type
          AND n.push_sent_at >= b.from_at
          AND n.push_sent_at < b.to_at
      ),
      notification_metrics AS (
        SELECT
          COUNT(*)::int AS "completedFanoutCount",
          COUNT(*) FILTER (WHERE push_delivered_at IS NOT NULL)::int
            AS "deviceAckCount",
          COUNT(*) FILTER (WHERE push_delivered_at IS NULL)::int
            AS "unacknowledgedCount",
          COUNT(*) FILTER (
            WHERE push_delivered_at >= push_sent_at
          )::int AS "latencySampleCount",
          COUNT(*) FILTER (
            WHERE push_delivered_at < push_sent_at
          )::int AS "negativeLatencyCount",
          (PERCENTILE_DISC(0.95) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (push_delivered_at - push_sent_at)) * 1000
          ) FILTER (
            WHERE push_delivered_at >= push_sent_at
          ))::double precision AS "ackLatencyP95Ms"
        FROM notification_cohort
      ),
      outbox_metrics AS (
        SELECT
          COUNT(*) FILTER (
            WHERE n.id IS NOT NULL
              AND o.dead_at >= b.from_at
              AND o.dead_at < b.to_at
          )::int AS "outboxDeadCount",
          COUNT(*) FILTER (
            WHERE n.id IS NOT NULL
              AND o.sent_at >= b.from_at
              AND o.sent_at < b.to_at
              AND n.push_sent_at IS NULL
              AND o.dead_at IS NULL
          )::int AS "closedWithoutRecordedFanoutCount",
          COUNT(*) FILTER (
            WHERE n.id IS NULL
              AND o.sent_at >= b.from_at
              AND o.sent_at < b.to_at
          )::int AS "missingNotificationForClosedOutboxCount"
        FROM notification_outbox o
        CROSS JOIN bounds b
        LEFT JOIN notifications n ON n.id = o.notification_id
        WHERE o.type = b.notification_type
      )
      SELECT nm.*, om.*
      FROM notification_metrics nm
      CROSS JOIN outbox_metrics om
    `);
    if (!aggregate) throw new Error('Push observation aggregate missing');
    this.assertValidAggregate(aggregate);

    return {
      signal: 'push.offer_observation',
      state: 'observed',
      window: { from: query.from, to: query.to },
      observedAt: observedAt.toISOString(),
      ...aggregate,
      providerAcceptance: 'not_observed',
      delivery: 'not_determined_by_source',
    };
  }

  private assertValidAggregate(
    aggregate: PushObservationAggregate,
  ): asserts aggregate is PushObservationAggregate {
    const countsValid = COUNT_FIELDS.every((field) => {
      const value = aggregate[field];
      return typeof value === 'number' && Number.isInteger(value) && value >= 0;
    });
    const p95 = aggregate.ackLatencyP95Ms;
    const p95Valid =
      aggregate.latencySampleCount === 0
        ? p95 === null
        : typeof p95 === 'number' && Number.isFinite(p95) && p95 >= 0;
    if (
      !countsValid ||
      aggregate.deviceAckCount + aggregate.unacknowledgedCount !==
        aggregate.completedFanoutCount ||
      aggregate.latencySampleCount + aggregate.negativeLatencyCount !==
        aggregate.deviceAckCount ||
      !p95Valid
    ) {
      throw new Error('Push observation aggregate invalid');
    }
  }
}
