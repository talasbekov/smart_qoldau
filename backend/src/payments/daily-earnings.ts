import { COMMISSION_BP_REGULAR } from '../premium/premium.constants';

// Весь учёт в проекте ведётся по Алматы: сутки офферов, начисления,
// «сегодня» на дашборде. День дохода обязан считаться так же, иначе
// вечерние консультации уезжают во вчера.
const ALMATY = 'Asia/Almaty';

// Верхняя граница периода: без неё один запрос выгружает всю историю
// эксперта, и график за неделю стоит столько же, сколько за три года.
export const MAX_DAILY_RANGE_DAYS = 366;

export type DailyEarning = {
  date: string;
  amountTiyn: number;
  consultations: number;
};

type PaymentRow = { updatedAt: Date; amountTiyn: number; discountTiyn: number };

function almatyDay(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: ALMATY });
}

// Эксперту достаётся 85 % ПОЛНОЙ цены. Premium-скидка клиента — расход
// платформы, доля эксперта от неё не страдает (Р-02, Р-03).
function expertShare(payment: PaymentRow): number {
  const full = payment.amountTiyn + payment.discountTiyn;
  return full - Math.round((full * COMMISSION_BP_REGULAR) / 10_000);
}

export function groupByAlmatyDay(
  payments: PaymentRow[],
  from: Date,
  to: Date,
): DailyEarning[] {
  const totals = new Map<string, { amountTiyn: number; consultations: number }>();

  for (const payment of payments) {
    const key = almatyDay(payment.updatedAt);
    const current = totals.get(key) ?? { amountTiyn: 0, consultations: 0 };
    current.amountTiyn += expertShare(payment);
    current.consultations += 1;
    totals.set(key, current);
  }

  // Дни без дохода присутствуют нулями: иначе график рвётся, а пропуск
  // читается как «данных нет», хотя данные есть и они нулевые.
  const days: DailyEarning[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    const key = almatyDay(cursor);
    const found = totals.get(key);
    days.push({
      date: key,
      amountTiyn: found?.amountTiyn ?? 0,
      consultations: found?.consultations ?? 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}
