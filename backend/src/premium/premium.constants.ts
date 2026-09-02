import { SubscriptionPlan } from '@prisma/client';

/// Р-08: единая цена на всех поверхностях. В тиынах, как все деньги проекта.
///
/// Цена месяца поднята с 2 990 ₸ до 4 990 ₸ решением владельца от
/// 2026-09-02 (расхождение прототипа закрыто в пользу прототипа).
/// Годовой тариф пересчитан по прежней пропорции — восемь месячных цен
/// за двенадцать месяцев: 4 990 × 8 = 39 920, округлено до 39 900 ₸.
export const PREMIUM_PRICES: Record<SubscriptionPlan, number> = {
  MONTH: 499_000, // 4 990 ₸
  YEAR: 3_990_000, // 39 900 ₸
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
