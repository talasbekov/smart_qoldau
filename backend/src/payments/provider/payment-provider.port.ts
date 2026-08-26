// DI-токен провайдера платежей (abstract class, как принято в проекте для
// портов). Реальный провайдер подключается через
// {provide: PaymentProviderPort, useClass: ...}; на текущем этапе — мок.
export abstract class PaymentProviderPort {
  abstract tokenizeCard(input: {
    pan: string;
    expiry: string;
    holderName: string;
  }): Promise<{ token: string; maskedPan: string; brand: string }>;

  abstract hold(input: {
    idempotencyKey: string;
    token: string;
    amountTiyn: number;
  }): Promise<{
    providerHoldId: string;
    status: 'held' | 'declined';
    declineReason?: string;
  }>;

  /// Разовое списание без холда — для подписки. У консультации холд нужен,
  /// потому что деньги замораживаются до исхода сессии; у подписки исхода
  /// нет: доступ выдаётся сразу по факту оплаты.
  abstract charge(input: {
    idempotencyKey: string;
    token: string;
    amountTiyn: number;
  }): Promise<{
    providerChargeId: string;
    status: 'captured' | 'declined';
    declineReason?: string;
  }>;

  abstract capture(input: {
    idempotencyKey: string;
    providerHoldId: string;
    amountTiyn: number;
  }): Promise<{ status: 'captured' }>;

  abstract void(input: {
    idempotencyKey: string;
    providerHoldId: string;
  }): Promise<{ status: 'voided' }>;
}
