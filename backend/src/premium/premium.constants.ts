import { SubscriptionPlan } from '@prisma/client';

/// Р-08: единая цена на всех поверхностях. В тиынах, как все деньги проекта.
export const PREMIUM_PRICES: Record<SubscriptionPlan, number> = {
  MONTH: 299_000, // 2 990 ₸
  YEAR: 2_390_000, // 23 900 ₸
};

/// Длина оплаченного периода. Месяц считаем в днях, а не «то же число
/// следующего месяца»: 31 января + месяц — источник вечных багов, а
/// пользователю разница в пару дней не видна.
export const PERIOD_DAYS: Record<SubscriptionPlan, number> = {
  MONTH: 30,
  YEAR: 365,
};

/// Р-09: 3 попытки списания за 72 часа, всё это время доступ сохраняется.
export const MAX_RENEW_ATTEMPTS = 3;
export const RENEW_WINDOW_HOURS = 72;

/// Р-03: комиссия платформы в базисных пунктах.
export const COMMISSION_BP_REGULAR = 1500;
export const COMMISSION_BP_PREMIUM = 500;
/// Р-03: скидка клиенту на консультацию.
export const PREMIUM_DISCOUNT_BP = 1000;
