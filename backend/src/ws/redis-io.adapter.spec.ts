import { RedisIoAdapter } from './redis-io.adapter';

const createAdapter = jest.fn(() => 'redis-adapter-fn');
jest.mock('@socket.io/redis-adapter', () => ({
  createAdapter: (...args: unknown[]) => createAdapter(...(args as [])),
}));

describe('RedisIoAdapter', () => {
  function makeRedis() {
    const duplicates: unknown[] = [];
    return {
      duplicate: jest.fn(() => {
        const copy = {
          name: `copy-${duplicates.length}`,
          quit: jest.fn(),
          publish: jest.fn().mockResolvedValue(0),
        };
        duplicates.push(copy);
        return copy;
      }),
      duplicates,
    };
  }

  it('берёт ДВА отдельных подключения: одно публикует, второе слушает', async () => {
    const redis = makeRedis();
    const adapter = new RedisIoAdapter({} as never, redis as never);

    await adapter.connectToRedis();

    // Подписанное соединение ioredis не принимает обычные команды —
    // публиковать в него нельзя, поэтому клиента ровно два.
    expect(redis.duplicate).toHaveBeenCalledTimes(2);
  });

  it('не трогает исходное подключение: на нём живут presence и лимиты', async () => {
    const redis = makeRedis();
    const adapter = new RedisIoAdapter({} as never, redis as never);

    await adapter.connectToRedis();

    // Перевод основного клиента в режим подписки сломал бы всё
    // остальное, что ходит в Redis.
    expect(redis.duplicates).toHaveLength(2);
  });

  it('ставит адаптер на созданный сервер: без него события не покидают инстанс', async () => {
    const redis = makeRedis();
    const adapter = new RedisIoAdapter({} as never, redis as never);
    await adapter.connectToRedis();
    const server = { adapter: jest.fn() };
    jest
      .spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(adapter)),
        'createIOServer',
      )
      .mockReturnValue(server);

    adapter.createIOServer(3000, {} as never);

    expect(server.adapter).toHaveBeenCalledWith('redis-adapter-fn');
  });

  it('без вызова connectToRedis адаптер не ставится молча, а падает', () => {
    const redis = makeRedis();
    const adapter = new RedisIoAdapter({} as never, redis as never);
    const server = { adapter: jest.fn() };
    jest
      .spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(adapter)),
        'createIOServer',
      )
      .mockReturnValue(server);

    // Молчаливый пропуск означал бы, что в проде сокеты разъехались, а
    // узнали бы мы об этом по жалобам, а не по падению.
    expect(() => adapter.createIOServer(3000, {} as never)).toThrow(
      /connectToRedis/,
    );
  });
});
