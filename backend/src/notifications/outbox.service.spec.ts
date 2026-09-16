import { Test } from '@nestjs/testing';
import { ClockService } from '../common/clock/clock.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushProviderPort } from './provider/push-provider.port';
import { OutboxSweepService } from './outbox-sweep.service';

// Юнит на моках Prisma: проверяется поведение разбора очереди — ретраи,
// экспоненциальная задержка, смерть после пяти попыток и ограничение
// конкурентности. База и провайдер здесь не нужны, нужна логика.
type Row = {
  id: string;
  notificationId: string;
  userId: string;
  type: string;
  payload: Record<string, string>;
  attempts: number;
};

describe('OutboxSweepService', () => {
  let service: OutboxSweepService;
  let rows: Row[];
  let updates: Array<{ id: string; data: Record<string, unknown> }>;
  let pushCalls: number;
  let inFlight: number;
  let maxInFlight: number;
  let pushFails: boolean;
  let pushHangs: boolean;
  let now: Date;

  const prisma = {
    $queryRaw: async () => rows,
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback(prisma),
    notificationOutbox: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; leaseToken: string };
        data: Record<string, unknown>;
      }) => {
        updates.push({ id: where.id, data });
        return { count: 1 };
      },
    },
    notification: {
      findUnique: async () => ({ title: 'Заголовок', body: 'Текст' }),
      updateMany: async () => ({ count: 1 }),
    },
    device: {
      findMany: async () => [{ id: 'd1', token: 'tok-1' }],
    },
  };

  const push: PushProviderPort = {
    send: async () => {
      pushCalls++;
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      if (pushHangs) return new Promise<void>(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      if (pushFails) throw new Error('провайдер недоступен');
    },
  } as unknown as PushProviderPort;

  beforeEach(async () => {
    rows = [];
    updates = [];
    pushCalls = 0;
    inFlight = 0;
    maxInFlight = 0;
    pushFails = false;
    pushHangs = false;
    now = new Date('2026-08-23T05:00:00.000Z');

    const moduleRef = await Test.createTestingModule({
      providers: [
        OutboxSweepService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockService, useValue: { now: () => now } },
        { provide: PushProviderPort, useValue: push },
      ],
    }).compile();
    service = moduleRef.get(OutboxSweepService);
  });

  function row(id: string, attempts = 0): Row {
    return {
      id,
      notificationId: `n-${id}`,
      userId: 'u1',
      type: 'offer.incoming',
      payload: { notificationId: `n-${id}`, type: 'offer.incoming' },
      attempts,
    };
  }

  function finalUpdate(): Record<string, unknown> {
    return updates[updates.length - 1].data;
  }

  it('успешная отправка закрывает запись', async () => {
    rows = [row('o1')];

    const processed = await service.tick();

    expect(processed).toBe(1);
    expect(pushCalls).toBe(1);
    expect(finalUpdate().sentAt).toEqual(now);
  });

  it('сбой провайдера не теряет запись: попытка растёт, отправка отодвигается', async () => {
    pushFails = true;
    rows = [row('o1')];

    await service.tick();

    expect(finalUpdate().attempts).toBe(1);
    expect(finalUpdate().sentAt).toBeUndefined();
    // Первая задержка — 2 секунды; провайдер, лежащий минуту, не должен
    // получать один и тот же запрос каждую секунду.
    expect(finalUpdate().nextAttemptAt).toEqual(new Date(now.getTime() + 2000));
  });

  it('задержка растёт экспоненциально', async () => {
    pushFails = true;
    rows = [row('o1', 2)];

    await service.tick();

    expect(finalUpdate().nextAttemptAt).toEqual(new Date(now.getTime() + 8000));
  });

  it('после пяти неудач запись помечается мёртвой и больше не берётся', async () => {
    pushFails = true;
    rows = [row('o1', 4)];

    await service.tick();

    expect(finalUpdate().deadAt).toEqual(now);
    expect(finalUpdate().nextAttemptAt).toBeUndefined();
    expect(finalUpdate().lastError).toContain('провайдер недоступен');
  });

  it('зависший provider ограничен таймаутом и оставляет job для retry', async () => {
    jest.useFakeTimers();
    try {
      pushHangs = true;
      rows = [row('o1')];

      const tick = service.tick();
      await jest.advanceTimersByTimeAsync(10_000);
      await tick;

      expect(finalUpdate().attempts).toBe(1);
      expect(finalUpdate().sentAt).toBeUndefined();
      expect(finalUpdate().lastError).toContain('timeout');
    } finally {
      jest.useRealTimers();
    }
  });

  it('сто записей не дают больше десяти одновременных вызовов провайдера', async () => {
    // Провайдер — внешняя система: сотня параллельных запросов это не
    // «быстрее», а отказ по rate limit.
    rows = Array.from({ length: 100 }, (_, i) => row(`o${i}`));

    await service.tick();

    expect(maxInFlight).toBeLessThanOrEqual(10);
  });
});
