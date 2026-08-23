import { ScheduledSweepService } from './scheduled-sweep.service';

// Sweep плановых консультаций (E6b, задача 6): напоминание за 15 минут
// (Р-15) и перевод SCHEDULED → ACTIVE в момент слота.
const NOW = new Date('2026-08-25T10:00:00Z');

type Row = {
  id: string;
  clientUserId: string;
  expertId: string;
  startedAt: Date;
  remindedAt: Date | null;
  status: string;
};

function makeService(rows: Row[]) {
  const dispatched: { userId: string; type: string }[] = [];
  const toExpert: { expertId: string; type: string }[] = [];
  const busy: string[] = [];
  const events: { event: string }[] = [];
  const audits: string[] = [];
  const state = new Map(rows.map((r) => [r.id, { ...r }]));

  const prisma = {
    consultation: {
      findMany: async ({ where }: { where: Record<string, any> }) => {
        const list = [...state.values()];
        if (where.remindedAt === null) {
          // Окно напоминания: [now, now + 15 минут].
          return list.filter(
            (r) =>
              r.status === 'SCHEDULED' &&
              r.remindedAt === null &&
              r.startedAt >= where.startedAt.gte &&
              r.startedAt <= where.startedAt.lte,
          );
        }
        return list.filter(
          (r) => r.status === 'SCHEDULED' && r.startedAt <= where.startedAt.lte,
        );
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, any>;
        data: Record<string, any>;
      }) => {
        const row = state.get(where.id);
        if (!row) return { count: 0 };
        if (where.status && row.status !== where.status) return { count: 0 };
        if (where.remindedAt === null && row.remindedAt !== null) {
          return { count: 0 };
        }
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    expert: {
      findUnique: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        userId: `user-of-${where.id}`,
      }),
    },
  };

  const service = new ScheduledSweepService(
    prisma as never,
    { now: () => NOW } as never,
    {
      dispatch: async (userId: string, type: string) => {
        dispatched.push({ userId, type });
      },
      dispatchToExpert: async (expertId: string, type: string) => {
        toExpert.push({ expertId, type });
      },
    } as never,
    {
      emitToUser: () => events.push({ event: 'user' }),
      emitToExpert: () => events.push({ event: 'expert' }),
    } as never,
    {
      markExpertBusy: async (expertId: string) => busy.push(expertId),
    } as never,
    {
      log: async ({ transition }: { transition: string }) => {
        audits.push(transition);
      },
    } as never,
  );

  return { service, dispatched, toExpert, busy, audits, state };
}

const row = (overrides: Partial<Row> = {}): Row => ({
  id: 'c1',
  clientUserId: 'client-1',
  expertId: 'e1',
  startedAt: new Date(NOW.getTime() + 14 * 60_000),
  remindedAt: null,
  status: 'SCHEDULED',
  ...overrides,
});

describe('ScheduledSweepService.tick', () => {
  it('за 14 минут до начала напоминает обеим сторонам и помечает запись', async () => {
    const { service, dispatched, toExpert, state } = makeService([row()]);

    await service.tick();

    expect(dispatched).toEqual([
      { userId: 'client-1', type: 'consultation.reminder' },
    ]);
    expect(toExpert).toEqual([
      { expertId: 'e1', type: 'consultation.reminder' },
    ]);
    expect(state.get('c1')!.remindedAt).not.toBeNull();
  });

  it('повторный тик второго напоминания не шлёт', async () => {
    const { service, dispatched } = makeService([row()]);

    await service.tick();
    await service.tick();

    expect(dispatched).toHaveLength(1);
  });

  it('за 40 минут до начала напоминания нет', async () => {
    const { service, dispatched, toExpert } = makeService([
      row({ startedAt: new Date(NOW.getTime() + 40 * 60_000) }),
    ]);

    await service.tick();

    expect(dispatched).toEqual([]);
    expect(toExpert).toEqual([]);
  });

  it('просроченная запись активируется без запоздалого напоминания', async () => {
    // Инстанс лежал: начало прошло 5 минут назад, напоминание не уходило.
    const { service, dispatched, state, audits, busy } = makeService([
      row({ startedAt: new Date(NOW.getTime() - 5 * 60_000) }),
    ]);

    await service.tick();

    // «Через 15 минут» о том, что началось 5 минут назад, дезориентирует.
    expect(dispatched).toEqual([]);
    expect(state.get('c1')!.status).toBe('ACTIVE');
    expect(busy).toEqual(['e1']);
    expect(audits).toContain('consultation.activated');
  });

  it('отменённая запись не активируется', async () => {
    const { service, state } = makeService([
      row({
        status: 'CANCELLED',
        startedAt: new Date(NOW.getTime() - 60_000),
      }),
    ]);

    await service.tick();

    expect(state.get('c1')!.status).toBe('CANCELLED');
  });
});
