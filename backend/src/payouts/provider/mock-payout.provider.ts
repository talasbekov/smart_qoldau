import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../../redis/redis.service';
import { PayoutProviderPort } from './payout-provider.port';

// 30 дней, как HOLD_TTL мок-провайдера платежей: ретрай застрявшей отправки
// может прийти сильно позже первого вызова.
const IDEM_TTL_SECONDS = 30 * 24 * 60 * 60;

// Детерминированный мок payout-провайдера для dev/тестов (паттерн
// MockPaymentProvider). Идемпотентность по mockpayout:idem:{key}: повторный
// sendToCard с тем же ключом возвращает тот же providerRefId.
@Injectable()
export class MockPayoutProvider extends PayoutProviderPort {
  constructor(private redis: RedisService) {
    super();
  }

  private idemKey(key: string): string {
    return `mockpayout:idem:${key}`;
  }

  async sendToCard(input: {
    idempotencyKey: string;
    cardToken: string;
    amountTiyn: number;
  }): Promise<{ providerRefId: string; status: 'processing' }> {
    const providerRefId = `mockpayout_ref_${randomUUID()}`;

    const reserved = await this.redis.set(
      this.idemKey(input.idempotencyKey),
      providerRefId,
      'EX',
      IDEM_TTL_SECONDS,
      'NX',
    );

    if (reserved !== 'OK') {
      // Проиграли гонку резервации — победитель уже записал свой refId
      // (см. комментарий про окно видимости в MockPaymentProvider.hold).
      for (let attempt = 0; attempt < 20; attempt++) {
        const winnerRefId = await this.redis.get(
          this.idemKey(input.idempotencyKey),
        );
        if (winnerRefId) {
          return { providerRefId: winnerRefId, status: 'processing' };
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error('MockPayoutProvider: не дождались refId победителя');
    }

    return { providerRefId, status: 'processing' };
  }
}
