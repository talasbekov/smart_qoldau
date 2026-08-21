// DI-токен провайдера выплат (abstract class, как PaymentProviderPort).
// Отправка денег на карту асинхронна: провайдер сразу отвечает 'processing',
// финальное подтверждение приходит вебхуком POST /v1/webhooks/payouts.
export abstract class PayoutProviderPort {
  abstract sendToCard(input: {
    idempotencyKey: string;
    cardToken: string;
    amountTiyn: number;
  }): Promise<{ providerRefId: string; status: 'processing' }>;
}
