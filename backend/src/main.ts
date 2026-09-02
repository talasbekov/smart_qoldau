import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { RedisService } from './redis/redis.service';
import { RedisIoAdapter } from './ws/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApp(app);

  // Сокеты обязаны работать между инстансами: без общего адаптера
  // событие, отправленное на одном процессе, не дойдёт до человека,
  // подключённого к другому — чат замолчит, а оффер уйдёт в пустоту.
  const adapter = new RedisIoAdapter(app, app.get(RedisService));
  await adapter.connectToRedis();
  app.useWebSocketAdapter(adapter);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
