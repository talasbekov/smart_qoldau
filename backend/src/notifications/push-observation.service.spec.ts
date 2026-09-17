import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClockService } from '../common/clock/clock.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushObservationService } from './push-observation.service';

const OBSERVED_AT = new Date('2026-09-17T12:00:00.900Z');
const VALID_QUERY = {
  from: '2026-09-16T12:00:00.900Z',
  to: '2026-09-17T12:00:00.900Z',
};
const AGGREGATE = {
  completedFanoutCount: 37,
  deviceAckCount: 29,
  unacknowledgedCount: 8,
  latencySampleCount: 28,
  negativeLatencyCount: 1,
  ackLatencyP95Ms: 2180,
  outboxDeadCount: 2,
  closedWithoutRecordedFanoutCount: 4,
  missingNotificationForClosedOutboxCount: 0,
};

describe('PushObservationService', () => {
  const queryRaw = jest.fn();
  const now = jest.fn(() => new Date(OBSERVED_AT));
  let service: PushObservationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    queryRaw.mockResolvedValue([AGGREGATE]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        PushObservationService,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
        { provide: ClockService, useValue: { now } },
      ],
    }).compile();
    service = moduleRef.get(PushObservationService);
  });

  it('returns only the exact successful observation DTO', async () => {
    await expect(service.observe(VALID_QUERY)).resolves.toEqual({
      signal: 'push.offer_observation',
      state: 'observed',
      window: VALID_QUERY,
      observedAt: '2026-09-17T12:00:00.900Z',
      ...AGGREGATE,
      providerAcceptance: 'not_observed',
      delivery: 'not_determined_by_source',
    });
    expect(now).toHaveBeenCalledTimes(1);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('emits one read-only parameterized aggregate statement', async () => {
    await service.observe(VALID_QUERY);

    const sql = queryRaw.mock.calls[0][0] as {
      strings: string[];
      values: unknown[];
    };
    const text = sql.strings.join('?').toLowerCase();
    expect(text).toContain('with');
    expect(text).toContain('percentile_disc(0.95)');
    expect(text).toContain('notifications');
    expect(text).toContain('notification_outbox');
    expect(text).not.toMatch(/\b(insert|update|delete|truncate|call)\b/);
    expect(text).not.toMatch(
      /user_id|device_token|\btitle\b|\bbody\b|\bpayload\b|last_error|provider_message/,
    );
    expect(sql.values).toEqual([
      VALID_QUERY.from,
      VALID_QUERY.to,
      'offer.incoming',
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
    { ...AGGREGATE, completedFanoutCount: -1 },
    { ...AGGREGATE, completedFanoutCount: 37.5 },
    { ...AGGREGATE, unacknowledgedCount: 7 },
    { ...AGGREGATE, latencySampleCount: 27 },
    { ...AGGREGATE, latencySampleCount: 0, negativeLatencyCount: 29 },
    { ...AGGREGATE, ackLatencyP95Ms: -1 },
    { ...AGGREGATE, ackLatencyP95Ms: null },
  ])('rejects an impossible aggregate %#', async (aggregate) => {
    queryRaw.mockResolvedValueOnce([aggregate]);
    await expect(service.observe(VALID_QUERY)).rejects.toThrow(
      'Push observation aggregate invalid',
    );
  });

  it('allows null p95 only when there are no non-negative samples', async () => {
    queryRaw.mockResolvedValueOnce([
      {
        ...AGGREGATE,
        completedFanoutCount: 1,
        deviceAckCount: 0,
        unacknowledgedCount: 1,
        latencySampleCount: 0,
        negativeLatencyCount: 0,
        ackLatencyP95Ms: null,
      },
    ]);
    await expect(service.observe(VALID_QUERY)).resolves.toMatchObject({
      ackLatencyP95Ms: null,
      latencySampleCount: 0,
    });
  });

  it('rejects an absent aggregate row', async () => {
    queryRaw.mockResolvedValueOnce([]);
    await expect(service.observe(VALID_QUERY)).rejects.toThrow(
      'Push observation aggregate missing',
    );
  });

  it('propagates database failure instead of fabricating an observation', async () => {
    const error = new Error('database unavailable');
    queryRaw.mockRejectedValueOnce(error);
    await expect(service.observe(VALID_QUERY)).rejects.toBe(error);
  });
});
