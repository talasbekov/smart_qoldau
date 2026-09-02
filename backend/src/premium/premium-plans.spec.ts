import { PREMIUM_PRICES } from './premium.constants';

describe('цены Premium', () => {
  it('месяц стоит 4 990 ₸ (решение владельца от 2026-09-02)', () => {
    expect(PREMIUM_PRICES.MONTH).toBe(499_000);
  });

  it('год стоит как восемь месяцев — та же пропорция, что была до правки', () => {
    // 4 990 × 8 = 39 920, округлено до 39 900 ₸. Пропорция сохранена
    // сознательно: годовой тариф всегда давал ~4 месяца в подарок.
    expect(PREMIUM_PRICES.YEAR).toBe(3_990_000);
  });

  it('год выгоднее двенадцати месяцев, иначе тариф бессмысленен', () => {
    expect(PREMIUM_PRICES.YEAR).toBeLessThan(PREMIUM_PRICES.MONTH * 12);
  });

  it('цены в тиынах и делятся на 100: в тенге не бывает копеек в прайсе', () => {
    expect(PREMIUM_PRICES.MONTH % 100).toBe(0);
    expect(PREMIUM_PRICES.YEAR % 100).toBe(0);
  });
});
