import { INestApplication, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { ServerOptions } from 'socket.io';
import type Redis from 'ioredis';

// Без этого адаптера socket.io живёт в памяти ОДНОГО процесса: событие,
// отправленное на первом инстансе бэкенда, не дойдёт до человека,
// подключённого ко второму. С одним инстансом это незаметно, поэтому
// дыра и дожила до сих пор — а «быстрое реагирование» на офферы стало бы
// случайным ровно в тот день, когда бэкенд начнут масштабировать.
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;

  constructor(
    app: INestApplication,
    private readonly redis: Redis,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    // Два отдельных подключения, оба — копии основного. Подписанный
    // клиент ioredis не принимает обычные команды, поэтому публиковать
    // и слушать одним нельзя. Основное подключение не трогаем вовсе: на
    // нём живут presence, лимиты и очереди.
    const pub = this.redis.duplicate();
    const sub = this.redis.duplicate();

    // redis-adapter's broadcast/disconnect methods ignore publish's Promise.
    // Observe rejections here so a Redis outage cannot crash a business caller.
    const publish = pub.publish.bind(pub);
    pub.publish = (...args: Parameters<Redis['publish']>) => {
      const pending = publish(...args);
      void pending.catch((error: unknown) => {
        this.logger.error(
          `WS Redis publish failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
      return pending;
    };
    this.adapterConstructor = createAdapter(pub, sub);
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    if (!this.adapterConstructor) {
      // Молчаливый пропуск означал бы, что в проде сокеты разъехались, а
      // узнали бы мы об этом по жалобам пользователей.
      throw new Error(
        'RedisIoAdapter: connectToRedis() не вызван — сокеты остались бы в памяти одного процесса',
      );
    }

    const server = super.createIOServer(port, options) as {
      adapter: (factory: unknown) => void;
    };
    server.adapter(this.adapterConstructor);
    return server;
  }
}
