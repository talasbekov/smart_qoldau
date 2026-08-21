import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from '../../redis/redis.service';
import { PushProviderPort } from './push-provider.port';

const SENT_TTL_SECONDS = 24 * 60 * 60;

// Детерминированный мок push-провайдера для dev/тестов (паттерн
// MockPaymentProvider): отправки складываются в Redis-список
// mockpush:sent:{token}, управляемый сбой — флаг mockpush:fail:{token}.
@Injectable()
export class MockPushProvider extends PushProviderPort {
  constructor(private redis: RedisService) {
    super();
  }

  async send(input: {
    token: string;
    title: string;
    body: string;
    data: Record<string, string>;
    critical: boolean;
  }): Promise<{ providerMessageId: string }> {
    const failFlag = await this.redis.get(`mockpush:fail:${input.token}`);
    if (failFlag) {
      throw new ServiceUnavailableException('Push-провайдер недоступен (мок)');
    }

    const providerMessageId = `mockpush_msg_${randomUUID()}`;
    const key = `mockpush:sent:${input.token}`;
    await this.redis.rpush(
      key,
      JSON.stringify({
        providerMessageId,
        title: input.title,
        body: input.body,
        data: input.data,
        critical: input.critical,
      }),
    );
    await this.redis.expire(key, SENT_TTL_SECONDS);

    return { providerMessageId };
  }
}
