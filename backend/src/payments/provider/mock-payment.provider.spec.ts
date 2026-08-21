import { ConflictException } from '@nestjs/common';
import { MockPaymentProvider } from './mock-payment.provider';

// Юнит: RedisService мокается in-memory Map, реальный Redis не нужен.
describe('MockPaymentProvider (юнит)', () => {
  function makeRedisMock() {
    const store = new Map<string, string>();
    return {
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      set: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
        return 'OK';
      }),
      _store: store,
    } as any;
  }

  const VISA_PAN = '4111111111111111';
  const MASTERCARD_PAN = '5555555555554444';
  const DECLINE_PAN = '4111111111110002';

  describe('tokenizeCard', () => {
    it('маскирует PAN и определяет brand visa по первой цифре 4', async () => {
      const redis = makeRedisMock();
      const provider = new MockPaymentProvider(redis);

      const result = await provider.tokenizeCard({
        pan: VISA_PAN,
        expiry: '12/28',
        holderName: 'Ivan Petrov',
      });

      expect(result.maskedPan).toBe('**** 1111');
      expect(result.brand).toBe('visa');
      expect(result.token).toBeTruthy();
    });

    it('определяет brand mastercard по первой цифре 5', async () => {
      const redis = makeRedisMock();
      const provider = new MockPaymentProvider(redis);

      const result = await provider.tokenizeCard({
        pan: MASTERCARD_PAN,
        expiry: '12/28',
        holderName: 'Ivan Petrov',
      });

      expect(result.maskedPan).toBe('**** 4444');
      expect(result.brand).toBe('mastercard');
    });
  });

  describe('hold', () => {
    it('успешный холд для обычной карты -> status held', async () => {
      const redis = makeRedisMock();
      const provider = new MockPaymentProvider(redis);
      const { token } = await provider.tokenizeCard({
        pan: VISA_PAN,
        expiry: '12/28',
        holderName: 'Ivan Petrov',
      });

      const result = await provider.hold({
        idempotencyKey: 'idem-1',
        token,
        amountTiyn: 100000,
      });

      expect(result.status).toBe('held');
      expect(result.providerHoldId).toBeTruthy();
    });

    it('PAN, оканчивающийся на 0002 -> declined с причиной "Банк отклонил операцию"', async () => {
      const redis = makeRedisMock();
      const provider = new MockPaymentProvider(redis);
      const { token } = await provider.tokenizeCard({
        pan: DECLINE_PAN,
        expiry: '12/28',
        holderName: 'Ivan Petrov',
      });

      const result = await provider.hold({
        idempotencyKey: 'idem-decline',
        token,
        amountTiyn: 100000,
      });

      expect(result.status).toBe('declined');
      expect(result.declineReason).toBe('Банк отклонил операцию');
    });

    it('идемпотентность: повторный hold с тем же ключом возвращает тот же providerHoldId', async () => {
      const redis = makeRedisMock();
      const provider = new MockPaymentProvider(redis);
      const { token } = await provider.tokenizeCard({
        pan: VISA_PAN,
        expiry: '12/28',
        holderName: 'Ivan Petrov',
      });

      const first = await provider.hold({
        idempotencyKey: 'idem-2',
        token,
        amountTiyn: 100000,
      });
      const second = await provider.hold({
        idempotencyKey: 'idem-2',
        token,
        amountTiyn: 100000,
      });

      expect(second.status).toBe('held');
      expect(second.providerHoldId).toBe(first.providerHoldId);
    });

    it('declined не запоминается: повтор с тем же ключом на другой (не-0002) карте проходит', async () => {
      const redis = makeRedisMock();
      const provider = new MockPaymentProvider(redis);
      const declineToken = (
        await provider.tokenizeCard({
          pan: DECLINE_PAN,
          expiry: '12/28',
          holderName: 'Ivan Petrov',
        })
      ).token;
      const okToken = (
        await provider.tokenizeCard({
          pan: VISA_PAN,
          expiry: '12/28',
          holderName: 'Ivan Petrov',
        })
      ).token;

      const declined = await provider.hold({
        idempotencyKey: 'idem-retry',
        token: declineToken,
        amountTiyn: 100000,
      });
      expect(declined.status).toBe('declined');

      const retried = await provider.hold({
        idempotencyKey: 'idem-retry',
        token: okToken,
        amountTiyn: 100000,
      });
      expect(retried.status).toBe('held');
    });
  });

  describe('capture / void', () => {
    it('capture существующего held-холда -> captured', async () => {
      const redis = makeRedisMock();
      const provider = new MockPaymentProvider(redis);
      const { token } = await provider.tokenizeCard({
        pan: VISA_PAN,
        expiry: '12/28',
        holderName: 'Ivan Petrov',
      });
      const { providerHoldId } = await provider.hold({
        idempotencyKey: 'idem-3',
        token,
        amountTiyn: 100000,
      });

      const result = await provider.capture({
        idempotencyKey: 'idem-3-capture',
        providerHoldId,
        amountTiyn: 100000,
      });

      expect(result.status).toBe('captured');
    });

    it('capture несуществующего холда -> throw', async () => {
      const redis = makeRedisMock();
      const provider = new MockPaymentProvider(redis);

      await expect(
        provider.capture({
          idempotencyKey: 'idem-4',
          providerHoldId: 'mockpay_hold_nonexistent',
          amountTiyn: 100000,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('void существующего held-холда -> voided', async () => {
      const redis = makeRedisMock();
      const provider = new MockPaymentProvider(redis);
      const { token } = await provider.tokenizeCard({
        pan: VISA_PAN,
        expiry: '12/28',
        holderName: 'Ivan Petrov',
      });
      const { providerHoldId } = await provider.hold({
        idempotencyKey: 'idem-5',
        token,
        amountTiyn: 100000,
      });

      const result = await provider.void({
        idempotencyKey: 'idem-5-void',
        providerHoldId,
      });

      expect(result.status).toBe('voided');
    });

    it('void несуществующего холда -> throw', async () => {
      const redis = makeRedisMock();
      const provider = new MockPaymentProvider(redis);

      await expect(
        provider.void({
          idempotencyKey: 'idem-6',
          providerHoldId: 'mockpay_hold_nonexistent',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('идемпотентность: повторный capture с тем же ключом -> {status: captured} без ошибки', async () => {
      const redis = makeRedisMock();
      const provider = new MockPaymentProvider(redis);
      const { token } = await provider.tokenizeCard({
        pan: VISA_PAN,
        expiry: '12/28',
        holderName: 'Ivan Petrov',
      });
      const { providerHoldId } = await provider.hold({
        idempotencyKey: 'idem-cap-retry',
        token,
        amountTiyn: 100000,
      });

      const first = await provider.capture({
        idempotencyKey: 'idem-cap-retry-capture',
        providerHoldId,
        amountTiyn: 100000,
      });
      expect(first.status).toBe('captured');

      // Повтор с тем же ключом — сценарий ретрая settle после сбоя нашей
      // БД-транзакции: холд уже 'captured', но по ключу — no-op с тем же
      // успешным результатом, а не ConflictException.
      const second = await provider.capture({
        idempotencyKey: 'idem-cap-retry-capture',
        providerHoldId,
        amountTiyn: 100000,
      });
      expect(second.status).toBe('captured');
    });

    it('идемпотентность: повторный void с тем же ключом -> {status: voided} без ошибки', async () => {
      const redis = makeRedisMock();
      const provider = new MockPaymentProvider(redis);
      const { token } = await provider.tokenizeCard({
        pan: VISA_PAN,
        expiry: '12/28',
        holderName: 'Ivan Petrov',
      });
      const { providerHoldId } = await provider.hold({
        idempotencyKey: 'idem-void-retry',
        token,
        amountTiyn: 100000,
      });

      const first = await provider.void({
        idempotencyKey: 'idem-void-retry-void',
        providerHoldId,
      });
      expect(first.status).toBe('voided');

      const second = await provider.void({
        idempotencyKey: 'idem-void-retry-void',
        providerHoldId,
      });
      expect(second.status).toBe('voided');
    });

    it('capture после void -> throw', async () => {
      const redis = makeRedisMock();
      const provider = new MockPaymentProvider(redis);
      const { token } = await provider.tokenizeCard({
        pan: VISA_PAN,
        expiry: '12/28',
        holderName: 'Ivan Petrov',
      });
      const { providerHoldId } = await provider.hold({
        idempotencyKey: 'idem-7',
        token,
        amountTiyn: 100000,
      });
      await provider.void({ idempotencyKey: 'idem-7-void', providerHoldId });

      await expect(
        provider.capture({
          idempotencyKey: 'idem-7-capture',
          providerHoldId,
          amountTiyn: 100000,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('void после capture -> throw', async () => {
      const redis = makeRedisMock();
      const provider = new MockPaymentProvider(redis);
      const { token } = await provider.tokenizeCard({
        pan: VISA_PAN,
        expiry: '12/28',
        holderName: 'Ivan Petrov',
      });
      const { providerHoldId } = await provider.hold({
        idempotencyKey: 'idem-8',
        token,
        amountTiyn: 100000,
      });
      await provider.capture({
        idempotencyKey: 'idem-8-capture',
        providerHoldId,
        amountTiyn: 100000,
      });

      await expect(
        provider.void({ idempotencyKey: 'idem-8-void', providerHoldId }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
