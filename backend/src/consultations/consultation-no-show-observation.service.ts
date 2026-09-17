import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ConsultationOutcome,
  ConsultationStatus,
  Prisma,
} from '@prisma/client';
import { ClockService } from '../common/clock/clock.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConsultationNoShowObservationDto } from './dto/consultation-no-show-observation.dto';
import { ConsultationNoShowObservationQueryDto } from './dto/consultation-no-show-observation-query.dto';

const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;

type ConsultationNoShowObservationAggregate = {
  cohortCompletedCount: number;
  clientNoShowOutcomeCount: number;
  completedOutcomeCount: number;
  clientCancelledOutcomeCount: number;
  techIssueOutcomeCount: number;
  expertCancelledOutcomeCount: number;
  completedWithoutOutcomeCount: number;
  completedWithoutEndedAtCountAllTime: number;
};

const COUNT_FIELDS: (keyof ConsultationNoShowObservationAggregate)[] = [
  'cohortCompletedCount',
  'clientNoShowOutcomeCount',
  'completedOutcomeCount',
  'clientCancelledOutcomeCount',
  'techIssueOutcomeCount',
  'expertCancelledOutcomeCount',
  'completedWithoutOutcomeCount',
  'completedWithoutEndedAtCountAllTime',
];

@Injectable()
export class ConsultationNoShowObservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  async observe(
    query: ConsultationNoShowObservationQueryDto,
  ): Promise<ConsultationNoShowObservationDto> {
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
      throw new BadRequestException(
        'Invalid consultation no-show observation window',
      );
    }

    // The windowed outcome distribution and the separate all-time integrity
    // count share one PostgreSQL statement snapshot. This is an observation
    // of recorded endedAt/outcome state, not a causal as-of reconstruction.
    const [aggregate] = await this.prisma.$queryRaw<
      ConsultationNoShowObservationAggregate[]
    >(Prisma.sql`
      WITH bounds AS (
        SELECT
          (${query.from}::timestamptz AT TIME ZONE 'UTC') AS from_at,
          (${query.to}::timestamptz AT TIME ZONE 'UTC') AS to_at,
          ${ConsultationStatus.COMPLETED}::"ConsultationStatus" AS completed_status,
          ${ConsultationOutcome.CLIENT_NO_SHOW}::"ConsultationOutcome" AS client_no_show_outcome,
          ${ConsultationOutcome.COMPLETED}::"ConsultationOutcome" AS completed_outcome,
          ${ConsultationOutcome.CLIENT_CANCELLED}::"ConsultationOutcome" AS client_cancelled_outcome,
          ${ConsultationOutcome.TECH_ISSUE}::"ConsultationOutcome" AS tech_issue_outcome,
          ${ConsultationOutcome.EXPERT_CANCELLED}::"ConsultationOutcome" AS expert_cancelled_outcome
      ),
      window_metrics AS (
        SELECT
          COUNT(*)::int AS "cohortCompletedCount",
          COUNT(*) FILTER (
            WHERE c.outcome = b.client_no_show_outcome
          )::int AS "clientNoShowOutcomeCount",
          COUNT(*) FILTER (
            WHERE c.outcome = b.completed_outcome
          )::int AS "completedOutcomeCount",
          COUNT(*) FILTER (
            WHERE c.outcome = b.client_cancelled_outcome
          )::int AS "clientCancelledOutcomeCount",
          COUNT(*) FILTER (
            WHERE c.outcome = b.tech_issue_outcome
          )::int AS "techIssueOutcomeCount",
          COUNT(*) FILTER (
            WHERE c.outcome = b.expert_cancelled_outcome
          )::int AS "expertCancelledOutcomeCount",
          COUNT(*) FILTER (
            WHERE c.outcome IS NULL
          )::int AS "completedWithoutOutcomeCount"
        FROM consultations c
        CROSS JOIN bounds b
        WHERE c.status = b.completed_status
          AND c.ended_at >= b.from_at
          AND c.ended_at < b.to_at
      ),
      integrity_metrics AS (
        SELECT
          COUNT(*) FILTER (
            WHERE c.status = b.completed_status
              AND c.ended_at IS NULL
          )::int AS "completedWithoutEndedAtCountAllTime"
        FROM consultations c
        CROSS JOIN bounds b
      )
      SELECT wm.*, im.*
      FROM window_metrics wm
      CROSS JOIN integrity_metrics im
    `);
    if (!aggregate) {
      throw new Error('Consultation no-show observation aggregate missing');
    }
    this.assertValidAggregate(aggregate);

    return {
      signal: 'consultation.client_no_show_observation',
      state: 'observed',
      window: { from: query.from, to: query.to },
      observedAt: observedAt.toISOString(),
      cohortCompletedCount: aggregate.cohortCompletedCount,
      clientNoShowOutcomeCount: aggregate.clientNoShowOutcomeCount,
      outcomeCounts: {
        COMPLETED: aggregate.completedOutcomeCount,
        CLIENT_CANCELLED: aggregate.clientCancelledOutcomeCount,
        TECH_ISSUE: aggregate.techIssueOutcomeCount,
        EXPERT_CANCELLED: aggregate.expertCancelledOutcomeCount,
      },
      completedWithoutOutcomeCount: aggregate.completedWithoutOutcomeCount,
      completedWithoutEndedAtCountAllTime:
        aggregate.completedWithoutEndedAtCountAllTime,
    };
  }

  private assertValidAggregate(
    aggregate: ConsultationNoShowObservationAggregate,
  ): asserts aggregate is ConsultationNoShowObservationAggregate {
    const countsValid = COUNT_FIELDS.every((field) => {
      const value = aggregate[field];
      return typeof value === 'number' && Number.isInteger(value) && value >= 0;
    });
    const bucketTotal =
      aggregate.clientNoShowOutcomeCount +
      aggregate.completedOutcomeCount +
      aggregate.clientCancelledOutcomeCount +
      aggregate.techIssueOutcomeCount +
      aggregate.expertCancelledOutcomeCount +
      aggregate.completedWithoutOutcomeCount;
    if (!countsValid || bucketTotal !== aggregate.cohortCompletedCount) {
      throw new Error('Consultation no-show observation aggregate invalid');
    }
  }
}
