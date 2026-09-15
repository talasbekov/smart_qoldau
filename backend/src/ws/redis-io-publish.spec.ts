import { INestApplication, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisIoAdapter } from './redis-io.adapter';

// Redis adapter ignores publish()'s return value. A rejected publish must be
// observed at our integration boundary, even for fire-and-forget callers.
describe('RedisIoAdapter publication failure', () => {
  it('observes a rejected publish without an unhandled rejection', async () => {
    const redis = new Redis({ lazyConnect: true });
    const duplicates: Redis[] = [];
    const duplicate = redis.duplicate.bind(redis);
    jest.spyOn(redis, 'duplicate').mockImplementation((...args) => {
      const client = duplicate(...args);
      client.disconnect();
      duplicates.push(client);
      return client;
    });
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    try {
      const adapter = new RedisIoAdapter({} as INestApplication, redis);
      await adapter.connectToRedis();
      // Intentionally the same contract as redis-adapter: no await/catch here.
      void duplicates[0].publish('e292:test', 'payload');
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('publish failed'),
      );
    } finally {
      redis.disconnect();
      duplicates.forEach((client) => client.disconnect());
      jest.restoreAllMocks();
    }
  });
});
