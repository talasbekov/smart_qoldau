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
  let now: Date;

  const prisma = {
    notificationOutbox: {
      findMany: async () => rows,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        updates.push({ id: where.id, data });
        return { id: where.id };
      },
    },
    notification: {
      findUnique: async () => ({ title: 'Заголовок', body: 'Текст' }),
      update: async () => ({}),
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

  it('успешная отправка закрывает запись', async () => {
    rows = [row('o1')];

    const processed = await service.tick();

    expect(processed).toBe(1);
    expect(pushCalls).toBe(1);
    expect(updates[0].data.sentAt).toEqual(now);
  });

  it('сбой провайдера не теряет запись: попытка растёт, отправка отодвигается', async () => {
    pushFails = true;
    rows = [row('o1')];

    await service.tick();

    expect(updates[0].data.attempts).toBe(1);
    expect(updates[0].data.sentAt).toBeUndefined();
    // Первая задержка — 2 секунды; провайдер, лежащий минуту, не должен
    // получать один и тот же запрос каждую секунду.
    expect(updates[0].data.nextAttemptAt).toEqual(
      new Date(now.getTime() + 2000),
    );
  });

  it('задержка растёт экспоненциально', async () => {
    pushFails = true;
    rows = [row('o1', 2)];

    await service.tick();

    expect(updates[0].data.nextAttemptAt).toEqual(
      new Date(now.getTime() + 8000),
    );
  });

  it('после пяти неудач запись помечается мёртвой и больше не берётся', async () => {
    pushFails = true;
    rows = [row('o1', 4)];

    await service.tick();

    expect(updates[0].data.deadAt).toEqual(now);
    expect(updates[0].data.nextAttemptAt).toBeUndefined();
    expect(updates[0].data.lastError).toContain('провайдер недоступен');
  });

  it('сто записей не дают больше десяти одновременных вызовов провайдера', async () => {
    // Провайдер — внешняя система: сотня параллельных запросов это не
    // «быстрее», а отказ по rate limit.
    rows = Array.from({ length: 100 }, (_, i) => row(`o${i}`));

    await service.tick();

    expect(maxInFlight).toBeLessThanOrEqual(10);
  });
});
