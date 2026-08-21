// DI-токен push-провайдера (abstract class, как PaymentProviderPort).
// Боевой адаптер (FCM/APNs; critical -> data-only + CallKit/VoIP для обхода
// DND) подключается при появлении ключей проекта (E6/E7) через
// {provide: PushProviderPort, useClass: ...}; на текущем этапе — мок.
export abstract class PushProviderPort {
  abstract send(input: {
    token: string;
    title: string;
    body: string;
    data: Record<string, string>;
    critical: boolean;
  }): Promise<{ providerMessageId: string }>;
}
