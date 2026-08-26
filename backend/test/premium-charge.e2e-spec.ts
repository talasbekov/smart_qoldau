import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PaymentProviderPort } from '../src/payments/provider/payment-provider.port';
import { createApp } from './utils/create-app';

// Подписка списывает деньги сразу, без холда: у консультации холд нужен,
// потому что деньги заморожены до исхода сессии, а у подписки исхода нет —
// доступ выдаётся по факту оплаты.
describe('Платёжный порт: charge для подписки (e2e)', () => {
  let app: INestApplication;
  let provider: PaymentProviderPort;

  beforeAll(async () => {
    app = await createApp(Test.createTestingModule({ imports: [AppModule] }));
    provider = app.get(PaymentProviderPort);
  });
  afterAll(() => app.close());

  it('списывает сразу и идемпотентен по ключу', async () => {
    const { token } = await provider.tokenizeCard({
      pan: '4111111111111111',
      expiry: '12/30',
      holderName: 'IVAN IVANOV',
    });

    const first = await provider.charge({
      idempotencyKey: `sub:test:${Date.now()}:1`,
      token,
      amountTiyn: 299_000,
    });
    expect(first.status).toBe('captured');
    expect(first.providerChargeId).toBeTruthy();

    // Повтор с тем же ключом — тот же результат, второго списания нет.
    const again = await provider.charge({
      idempotencyKey: `sub:test:idem`,
      token,
      amountTiyn: 299_000,
    });
    const third = await provider.charge({
      idempotencyKey: `sub:test:idem`,
      token,
      amountTiyn: 299_000,
    });
    expect(third.providerChargeId).toBe(again.providerChargeId);
  });

  it('карта с признаком отказа даёт declined, а не исключение', async () => {
    const { token } = await provider.tokenizeCard({
      pan: '4000000000000002', // мок трактует его как «банк отказал»
      expiry: '12/30',
      holderName: 'IVAN IVANOV',
    });

    const result = await provider.charge({
      idempotencyKey: `sub:test:${Date.now()}:2`,
      token,
      amountTiyn: 299_000,
    });
    expect(result.status).toBe('declined');
    expect(result.declineReason).toBeTruthy();
  });
});
