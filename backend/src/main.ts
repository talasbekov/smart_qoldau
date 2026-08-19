import { NestFactory } from '@nestjs/core';
import { ValidationPipe, HttpException } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppExceptionFilter } from './common/filters/app-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  app.useGlobalFilters(new AppExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      exceptionFactory: (e) =>
        new HttpException(
          { code: 'VALIDATION_FAILED', message: 'Validation failed', details: e },
          400
        ),
    })
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
