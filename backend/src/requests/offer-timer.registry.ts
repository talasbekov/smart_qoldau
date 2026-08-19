// Интерфейс таймеров дедлайна оффера. Реальная реализация — OfferTimerService
// (Redis ZSET offers:deadlines + sweep), см. requests/offer-timer.service.ts.
// По истечении deadlineAt sweep() переводит оффер в TIMEOUT и вызывает
// RequestsService.offerToNext.
export interface OfferTimerRegistry {
  schedule(offerId: string, deadlineAt: Date): Promise<void>;
  cancel(offerId: string): Promise<void>;
}

export const OFFER_TIMER_REGISTRY = Symbol('OFFER_TIMER_REGISTRY');
