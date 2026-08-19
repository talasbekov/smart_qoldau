// Интерфейс-заглушка для таймеров дедлайна оффера. Задача 4 регистрирует
// no-op реализацию (NoopOfferTimer); задача 5 заменит на реальный
// провайдер, который по истечении deadlineAt переводит оффер в TIMEOUT и
// вызывает RequestsService.offerToNext.
export interface OfferTimerRegistry {
  schedule(offerId: string, deadlineAt: Date): Promise<void>;
  cancel(offerId: string): Promise<void>;
}

export const OFFER_TIMER_REGISTRY = Symbol('OFFER_TIMER_REGISTRY');

export class NoopOfferTimer implements OfferTimerRegistry {
  async schedule(): Promise<void> {
    // no-op — см. задачу 5.
  }

  async cancel(): Promise<void> {
    // no-op — см. задачу 5.
  }
}
