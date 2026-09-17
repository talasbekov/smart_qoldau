import { BadRequestException } from '@nestjs/common';
import { ConsultationOutcome, ConsultationStatus } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { ClockService } from '../common/clock/clock.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConsultationNoShowObservationService } from './consultation-no-show-observation.service';

const OBSERVED_AT = new Date('2026-09-17T12:00:00.900Z');
const VALID_QUERY = {
  from: '2026-09-16T12:00:00.900Z',
  to: '2026-09-17T12:00:00.900Z',
};
const AGGREGATE = {
  cohortCompletedCount: 14,
  clientNoShowOutcomeCount: 2,
  completedOutcomeCount: 8,
  clientCancelledOutcomeCount: 1,
  techIssueOutcomeCount: 2,
  expertCancelledOutcomeCount: 0,
  completedWithoutOutcomeCount: 1,
  completedWithoutEndedAtCountAllTime: 3,
};

describe('ConsultationNoShowObservationService', () => {
  const queryRaw = jest.fn();
  const now = jest.fn(() => new Date(OBSERVED_AT));
  let service: ConsultationNoShowObservationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    queryRaw.mockResolvedValue([AGGREGATE]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConsultationNoShowObservationService,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
        { provide: ClockService, useValue: { now } },
      ],
    }).compile();
    service = moduleRef.get(ConsultationNoShowObservationService);
  });

  it('returns the exact raw-count observation without a rate or alert result', async () => {
    const result = await service.observe(VALID_QUERY);

    expect(result).toEqual({
      signal: 'consultation.client_no_show_observation',
      state: 'observed',
      window: VALID_QUERY,
      observedAt: '2026-09-17T12:00:00.900Z',
      cohortCompletedCount: 14,
      clientNoShowOutcomeCount: 2,
      outcomeCounts: {
        COMPLETED: 8,
        CLIENT_CANCELLED: 1,
        TECH_ISSUE: 2,
        EXPERT_CANCELLED: 0,
      },
      completedWithoutOutcomeCount: 1,
      completedWithoutEndedAtCountAllTime: 3,
    });
    expect(result).not.toHaveProperty('ratio');
    expect(result).not.toHaveProperty('rate');
    expect(result).not.toHaveProperty('alert');
    expect(now).toHaveBeenCalledTimes(1);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('emits one read-only parameterized aggregate statement without hints or PII', async () => {
    await service.observe(VALID_QUERY);

    const sql = queryRaw.mock.calls[0][0] as {
      strings: string[];
      values: unknown[];
    };
    const text = sql.strings.join('?').toLowerCase();
    expect(text).toContain('with');
    expect(text).toContain('consultations');
    expect(text).toContain('ended_at >=');
    expect(text).toContain('ended_at <');
    expect(text).toContain('ended_at is null');
    expect(text).toContain('outcome is null');
    expect(text).not.toMatch(/\b(insert|update|delete|truncate|call)\b/);
    expect(text).not.toMatch(
      /no_show_notified|hint|started_at|client_user_id|client_code|expert_id|topic_id|request_id|payment/,
    );
    expect(sql.values).toEqual([
      VALID_QUERY.from,
      VALID_QUERY.to,
      ConsultationStatus.COMPLETED,
      ConsultationOutcome.CLIENT_NO_SHOW,
      ConsultationOutcome.COMPLETED,
      ConsultationOutcome.CLIENT_CANCELLED,
      ConsultationOutcome.TECH_ISSUE,
      ConsultationOutcome.EXPERT_CANCELLED,
    ]);
  });

  it.each([
    [
      { from: '2026-09-17T12:00:00.900Z', to: '2026-09-17T12:00:00.900Z' },
      'equal boundaries',
    ],
    [
      { from: '2026-09-17T12:00:00.901Z', to: '2026-09-17T12:00:00.900Z' },
      'reversed boundaries',
    ],
    [
      { from: '2026-09-17T11:00:00.900Z', to: '2026-09-17T12:00:00.901Z' },
      'future upper boundary',
    ],
    [
      { from: '2026-09-16T12:00:00.899Z', to: '2026-09-17T12:00:00.900Z' },
      'window over 24 hours',
    ],
    [
      { from: 'invalid', to: '2026-09-17T12:00:00.900Z' },
      'unparseable lower boundary',
    ],
  ])('rejects %s (%s) without reading the database', async (query) => {
    await expect(service.observe(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(now).toHaveBeenCalledTimes(1);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('accepts the exact 24-hour bound ending at observedAt', async () => {
    await service.observe(VALID_QUERY);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it.each([
    { ...AGGREGATE, cohortCompletedCount: -1 },
    { ...AGGREGATE, cohortCompletedCount: 14.5 },
    { ...AGGREGATE, clientNoShowOutcomeCount: Number.NaN },
    { ...AGGREGATE, completedOutcomeCount: -1 },
    { ...AGGREGATE, clientCancelledOutcomeCount: -1 },
    { ...AGGREGATE, techIssueOutcomeCount: -1 },
    { ...AGGREGATE, expertCancelledOutcomeCount: -1 },
    { ...AGGREGATE, completedWithoutOutcomeCount: -1 },
    { ...AGGREGATE, completedWithoutEndedAtCountAllTime: -1 },
    { ...AGGREGATE, completedOutcomeCount: 7 },
  ])('rejects an impossible aggregate %#', async (aggregate) => {
    queryRaw.mockResolvedValueOnce([aggregate]);
    await expect(service.observe(VALID_QUERY)).rejects.toThrow(
      'Consultation no-show observation aggregate invalid',
    );
  });

  it('rejects an absent aggregate row', async () => {
    queryRaw.mockResolvedValueOnce([]);
    await expect(service.observe(VALID_QUERY)).rejects.toThrow(
      'Consultation no-show observation aggregate missing',
    );
  });

  it('propagates database failure instead of fabricating an observation', async () => {
    const error = new Error('database unavailable');
    queryRaw.mockRejectedValueOnce(error);
    await expect(service.observe(VALID_QUERY)).rejects.toBe(error);
  });
});
