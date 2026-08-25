import {
  HttpException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppExceptionFilter } from './common/filters/app-exception.filter';

// Общий для /v1/docs и backend/scripts/dump-openapi.ts конфиг — контракт,
// который выгружает скрипт, обязан совпадать с тем, что отдаёт сам сервер.
export const swaggerConfig = new DocumentBuilder()
  .setTitle('SmartQoldau API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();

export function configureApp(app: INestApplication): void {
  // Базовые заголовки безопасности. CSP выключен: единственная HTML-страница
  // проекта — Swagger UI на /v1/docs, и дефолтная политика helmet ломает
  // его инлайновые скрипты; API-ответам CSP не нужен.
  app.use(helmet({ contentSecurityPolicy: false }));
  // E8: панель admin/ — браузерный SPA на другом origin (Vite dev-сервер),
  // без этого браузер блокирует ответ ещё до того, как код фронтенда его
  // увидит. Список разрешённых origin — из ADMIN_ORIGINS (через запятую),
  // по умолчанию только локальный Vite dev-сервер: НЕ origin:true — это
  // отражало бы Origin любого сайта, credentials не нужны — авторизация в
  // admin/ полностью на Bearer-токене, без cookie, но открытый CORS всё
  // равно даёт постороннему сайту вызвать API от лица залогиненного в
  // admin/ пользователя, если токен где-то ещё утёк.
  const adminOrigins = (
    process.env.ADMIN_ORIGINS ?? 'http://localhost:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: adminOrigins, credentials: false });
  app.setGlobalPrefix('v1');
  app.useGlobalFilters(new AppExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      exceptionFactory: (e) =>
        new HttpException(
          {
            code: 'VALIDATION_FAILED',
            message: 'Validation failed',
            details: e,
          },
          400,
        ),
    }),
  );

  SwaggerModule.setup(
    'v1/docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );
}
