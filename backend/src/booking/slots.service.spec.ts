import { SlotsService } from './slots.service';

// Слоты (E6b, задача 3) считаются на лету из расписания минус исключения
// минус занятые интервалы. Отдельной таблицы слотов нет: она была бы
// денормализацией расписания, которую пришлось бы держать в согласии.
//
// Виртуальное «сейчас»: понедельник 2026-08-24, 03:00 UTC = 08:00 Алматы.
const NOW = new Date('2026-08-24T03:00:00Z');

const clock = { now: () => NOW };

type Row = {
  weekday: number;
  enabled: boolean;
  startMin: number;
  endMin: number;
  breakStart?: number | null;
  breakEnd?: number | null;
};

function makeService(options: {
  now?: Date;
  days?: Row[];
  exceptions?: {
    date: Date;
    isDayOff: boolean;
    startMin?: number | null;
    endMin?: number | null;
  }[];
  consultations?: { startedAt: Date; status: string }[];
}): SlotsService {
  const days = options.days ?? [];
  const exceptions = options.exceptions ?? [];
  const consultations = options.consultations ?? [];
  const prisma = {
    expertScheduleDay: {
      findMany: async () => days,
    },
    scheduleException: {
      findMany: async () => exceptions,
    },
    consultation: {
      findMany: async () =>
        consultations.filter((c) => ['SCHEDULED', 'ACTIVE'].includes(c.status)),
    },
  };
  const serviceClock = options.now ? { now: () => options.now! } : clock;
  return new SlotsService(prisma as never, serviceClock as never);
}

const workday = (overrides: Partial<Row> = {}): Row[] =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    enabled: true,
    startMin: 540, // 09:00
    endMin: 1080, // 18:00
    breakStart: null,
    breakEnd: null,
    ...overrides,
  }));

/// Начало дня по Алматы в UTC: 2026-08-25 09:00 Алматы = 04:00 UTC.
const almaty = (isoDate: string, hour: number, minute = 0) =>
  new Date(
    `${isoDate}T${String(hour - 5).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`,
  );

const hoursOf = (slots: Date[]) =>
  slots.map((s) => s.toISOString().slice(11, 16));

describe('SlotsService.freeSlots', () => {
  const from = new Date('2026-08-25T00:00:00Z');
  const to = new Date('2026-08-25T23:59:59Z');

  it('рабочий день 09:00–18:00 без перерыва даёт девять слотов', async () => {
    const service = makeService({ days: workday() });
    const slots = await service.freeSlots('e1', from, to);

    expect(slots).toHaveLength(9);
    // 09:00 Алматы = 04:00 UTC — граница суток проверяется явно.
    expect(hoursOf(slots)[0]).toBe('04:00');
    expect(hoursOf(slots).at(-1)).toBe('12:00'); // 17:00 Алматы
  });

  it('перерыв 13:00–14:00 убирает слот 13:00 и только его', async () => {
    const service = makeService({
      days: workday({ breakStart: 780, breakEnd: 840 }),
    });
    const slots = hoursOf(await service.freeSlots('e1', from, to));

    expect(slots).not.toContain('08:00'); // 13:00 Алматы
    expect(slots).toContain('07:00'); // 12:00 Алматы
    expect(slots).toContain('09:00'); // 14:00 Алматы
  });

  it('окно короче слота не даёт ни одного слота', async () => {
    const service = makeService({
      days: workday({ startMin: 540, endMin: 580 }),
    });
    expect(await service.freeSlots('e1', from, to)).toEqual([]);
  });

  it('занятая консультация убирает свой слот и не трогает соседние', async () => {
    const service = makeService({
      days: workday(),
      consultations: [
        { startedAt: almaty('2026-08-25', 11), status: 'SCHEDULED' },
      ],
    });
    const slots = hoursOf(await service.freeSlots('e1', from, to));

    expect(slots).not.toContain('06:00'); // 11:00 Алматы
    expect(slots).toContain('05:00');
    expect(slots).toContain('07:00');
  });

  it('ACTIVE занимает слот так же, как SCHEDULED, а CANCELLED — нет', async () => {
    const active = makeService({
      days: workday(),
      consultations: [
        { startedAt: almaty('2026-08-25', 11), status: 'ACTIVE' },
      ],
    });
    expect(hoursOf(await active.freeSlots('e1', from, to))).not.toContain(
      '06:00',
    );

    const cancelled = makeService({
      days: workday(),
      consultations: [
        { startedAt: almaty('2026-08-25', 11), status: 'CANCELLED' },
      ],
    });
    expect(hoursOf(await cancelled.freeSlots('e1', from, to))).toContain(
      '06:00',
    );
  });

  it('слот ровно через час допускается, ближе часа — нет', async () => {
    const today = [
      new Date('2026-08-24T00:00:00Z'),
      new Date('2026-08-24T23:59:59Z'),
    ] as const;

    // 08:00 Алматы: до слота 09:00 ровно час — отступ выдержан.
    const exactly = makeService({ days: workday() });
    expect(hoursOf(await exactly.freeSlots('e1', ...today))[0]).toBe('04:00');

    // 08:01 Алматы: часа уже не остаётся, слот 09:00 уходит из выдачи.
    const tooLate = makeService({
      now: new Date('2026-08-24T03:01:00Z'),
      days: workday(),
    });
    const slots = hoursOf(await tooLate.freeSlots('e1', ...today));
    expect(slots).not.toContain('04:00');
    expect(slots[0]).toBe('05:00');
  });

  it('выходной-исключение убирает весь день', async () => {
    const service = makeService({
      days: workday(),
      exceptions: [{ date: new Date('2026-08-25T00:00:00Z'), isDayOff: true }],
    });
    expect(await service.freeSlots('e1', from, to)).toEqual([]);
  });

  it('исключение с иными часами перекрывает недельное расписание', async () => {
    const service = makeService({
      days: workday(),
      exceptions: [
        {
          date: new Date('2026-08-25T00:00:00Z'),
          isDayOff: false,
          startMin: 720, // 12:00
          endMin: 900, // 15:00
        },
      ],
    });
    const slots = hoursOf(await service.freeSlots('e1', from, to));

    expect(slots).toEqual(['07:00', '08:00', '09:00']); // 12,13,14 Алматы
  });

  it('выключенный день недели слотов не даёт', async () => {
    const service = makeService({ days: workday({ enabled: false }) });
    expect(await service.freeSlots('e1', from, to)).toEqual([]);
  });
});
