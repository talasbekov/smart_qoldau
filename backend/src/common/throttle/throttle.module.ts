import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { RedisModule } from '../../redis/redis.module';
import { RedisService } from '../../redis/redis.service';
import { THROTTLE_PROFILES } from './throttle.constants';

// Счётчики лимитов живут в Redis, а не в памяти процесса. Это не
// оптимизация, а условие корректности: при двух репликах пользователь
// иначе получает вдвое больший лимит, а рестарт обнуляет счётчик.
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: THROTTLE_PROFILES,
        storage: new ThrottlerStorageRedisService(redis),
        // Точечный выключатель для спеков, которым лимиты мешают по делу
        // (те, что честно делают десятки запросов подряд). Читается из
        // process.env НА КАЖДЫЙ запрос, а не через ConfigService: спеку,
        // который проверяет сами лимиты, нужно включить их себе уже после
        // старта приложения, а валидированный конфиг снимается один раз
        // при инициализации модуля.
        skipIf: () => process.env.THROTTLE_ENABLED === 'false',
      }),
    }),
  ],
  exports: [ThrottlerModule],
})
export class ThrottleModule {}
