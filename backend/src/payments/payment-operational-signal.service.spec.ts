import { Test } from '@nestjs/testing';
import { PaymentOperationalSignalService } from './payment-operational-signal.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../common/clock/clock.service';

describe('PaymentOperationalSignalService', () => {
  const queryRaw = jest.fn();
  const now = jest.fn(() => new Date('2026-09-17T12:00:00.900Z'));
  let service: PaymentOperationalSignalService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentOperationalSignalService,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
        { provide: ClockService, useValue: { now } },
      ],
    }).compile();
    service = moduleRef.get(PaymentOperationalSignalService);
  });

  it.each([
    [0, 0, 'ok'],
    [0, 3, 'unknown'],
    [2, 0, 'alerting'],
    [2, 3, 'alerting'],
    [151, 121, 'alerting'],
  ])('maps E=%i X=%i to %s with only aggregate fields', async (e, x, state) => {
    queryRaw.mockResolvedValue([
      { currentExhaustedCount: e, unexpectedContextCount: x },
    ]);
    await expect(service.operationalSignal()).resolves.toEqual({
      signal: 'payment.settle_exhausted',
      state,
      maxAttempts: 10,
      currentExhaustedCount: e,
      unexpectedContextCount: x,
      providerOutcome: 'not_determined_by_source',
      observedAt: '2026-09-17T12:00:00.900Z',
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(now).toHaveBeenCalledTimes(1);
  });

  it('propagates database failure instead of fabricating a healthy snapshot', async () => {
    const error = new Error('database unavailable');
    queryRaw.mockRejectedValueOnce(error);
    await expect(service.operationalSignal()).rejects.toBe(error);
  });

  it('rejects an absent aggregate row instead of returning ok', async () => {
    queryRaw.mockResolvedValueOnce([]);
    await expect(service.operationalSignal()).rejects.toThrow();
  });
});
