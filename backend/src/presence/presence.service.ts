import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const AVAILABLE_SET_KEY = 'experts:available';

// Тонкая обёртка над Redis SET для присутствия эксперта. Контракт для
// матчинга E3: свободные эксперты живут в experts:available.
@Injectable()
export class PresenceService {
  constructor(private redis: RedisService) {}

  async setAvailable(expertId: string): Promise<void> {
    await this.redis.sadd(AVAILABLE_SET_KEY, expertId);
  }

  async setUnavailable(expertId: string): Promise<void> {
    await this.redis.srem(AVAILABLE_SET_KEY, expertId);
  }

  async isAvailable(expertId: string): Promise<boolean> {
    return (await this.redis.sismember(AVAILABLE_SET_KEY, expertId)) === 1;
  }

  async listAvailable(): Promise<string[]> {
    return this.redis.smembers(AVAILABLE_SET_KEY);
  }
}
