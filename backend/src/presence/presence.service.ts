import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ClockService } from '../common/clock/clock.service';

const AVAILABLE_SET_KEY = 'experts:available';
const LASTSEEN_HASH_KEY = 'experts:lastseen';
const DEFAULT_STALE_MS = 90_000;

// Тонкая обёртка над Redis SET/HASH для присутствия эксперта. Контракт для
// матчинга E3: свободные эксперты живут в experts:available, их свежесть
// (heartbeat) — в experts:lastseen (HSET field=expertId, value=ms от
// ClockService.now()). listFresh() — SMEMBERS ∩ фильтр по свежести lastseen.
@Injectable()
export class PresenceService {
  constructor(
    private redis: RedisService,
    private clock: ClockService,
  ) {}

  async setAvailable(expertId: string): Promise<void> {
    await this.redis.sadd(AVAILABLE_SET_KEY, expertId);
    // Иначе только что включившийся эксперт будет «несвежим» до heartbeat.
    await this.touch(expertId);
  }

  async setUnavailable(expertId: string): Promise<void> {
    await this.redis.srem(AVAILABLE_SET_KEY, expertId);
    await this.redis.hdel(LASTSEEN_HASH_KEY, expertId);
  }

  async isAvailable(expertId: string): Promise<boolean> {
    return (await this.redis.sismember(AVAILABLE_SET_KEY, expertId)) === 1;
  }

  async listAvailable(): Promise<string[]> {
    return this.redis.smembers(AVAILABLE_SET_KEY);
  }

  async touch(expertId: string): Promise<void> {
    await this.redis.hset(
      LASTSEEN_HASH_KEY,
      expertId,
      String(this.clock.now().getTime()),
    );
  }

  async listFresh(staleMs = DEFAULT_STALE_MS): Promise<string[]> {
    const available = await this.listAvailable();
    if (available.length === 0) return [];

    const lastSeenValues = await this.redis.hmget(
      LASTSEEN_HASH_KEY,
      ...available,
    );
    const now = this.clock.now().getTime();
    return available.filter((id, index) => {
      const lastSeen = lastSeenValues[index];
      if (lastSeen === null) return false;
      return now - Number(lastSeen) <= staleMs;
    });
  }
}
