import { groupByAlmatyDay, MAX_DAILY_RANGE_DAYS } from './daily-earnings';

const payment = (updatedAt: string, amountTiyn: number) => ({
  updatedAt: new Date(updatedAt),
  amountTiyn,
  discountTiyn: 0,
});

describe('groupByAlmatyDay', () => {
  it('складывает начисления одного дня', () => {
    const days = groupByAlmatyDay(
      [payment('2026-09-01T06:00:00.000Z', 100_000), payment('2026-09-01T09:00:00.000Z', 200_000)],
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2026-09-01T00:00:00.000Z'),
    );

    expect(days).toEqual([
      { date: '2026-09-01', amountTiyn: 255_000, consultations: 2 },
    ]);
  });

  it('день считается по Алматы, а не по UTC', () => {
    // 2026-09-01T20:00Z — это уже 2 сентября в Алматы (UTC+5).
    const days = groupByAlmatyDay(
      [payment('2026-09-01T20:00:00.000Z', 100_000)],
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2026-09-02T00:00:00.000Z'),
    );

    expect(days.find((d) => d.date === '2026-09-02')?.consultations).toBe(1);
    expect(days.find((d) => d.date === '2026-09-01')?.consultations).toBe(0);
  });

  it('дни без дохода присутствуют нулями: иначе график рвётся', () => {
    const days = groupByAlmatyDay(
      [payment('2026-09-03T06:00:00.000Z', 100_000)],
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2026-09-03T00:00:00.000Z'),
    );

    expect(days).toHaveLength(3);
    expect(days[0]).toEqual({ date: '2026-09-01', amountTiyn: 0, consultations: 0 });
  });

  it('удерживает 15 % — ту же долю, что в списке начислений', () => {
    const days = groupByAlmatyDay(
      [payment('2026-09-01T06:00:00.000Z', 399_000)],
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2026-09-01T00:00:00.000Z'),
    );

    // 3990 ₸ − 15 % = 3391,50 ₸; в тиынах 339 150.
    expect(days[0].amountTiyn).toBe(339_150);
  });

  it('Premium-скидка не уменьшает долю эксперта', () => {
    const days = groupByAlmatyDay(
      [{ updatedAt: new Date('2026-09-01T06:00:00.000Z'), amountTiyn: 359_100, discountTiyn: 39_900 }],
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2026-09-01T00:00:00.000Z'),
    );

    // Скидка клиента — расход платформы: эксперт получает 85 % ПОЛНОЙ цены.
    expect(days[0].amountTiyn).toBe(339_150);
  });

  it('период ограничен сверху, чтобы не выгружать всю историю разом', () => {
    expect(MAX_DAILY_RANGE_DAYS).toBeLessThanOrEqual(366);
  });

  it('пустой список даёт нули за весь период, а не пустой ответ', () => {
    const days = groupByAlmatyDay(
      [],
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2026-09-02T00:00:00.000Z'),
    );

    expect(days).toHaveLength(2);
    expect(days.every((d) => d.amountTiyn === 0)).toBe(true);
  });
});
