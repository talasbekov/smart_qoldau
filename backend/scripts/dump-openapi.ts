// Выгружает OpenAPI-контракт бэкенда в docs/openapi.json — тот же документ,
// что отдаёт /v1/docs, без поднятия HTTP-сервера. Против этого файла задача 4
// эпика E6 пишет контрактный тест клиента.
import { writeFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { configureApp, swaggerConfig } from '../src/bootstrap';

const OUTPUT_PATH = join(__dirname, '..', '..', 'docs', 'openapi.json');

async function dumpOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.init();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  writeFileSync(OUTPUT_PATH, JSON.stringify(document, null, 2));

  await app.close();
  // Prisma/Redis могут держать хендлы после close() — форсируем выход.
  process.exit(0);
}

dumpOpenApi().catch((error) => {
  console.error(error);
  process.exit(1);
});
