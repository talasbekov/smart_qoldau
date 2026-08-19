import {
  HttpException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppExceptionFilter } from './common/filters/app-exception.filter';

export function configureApp(app: INestApplication): void {
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

  const config = new DocumentBuilder()
    .setTitle('SmartQoldau API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    'v1/docs',
    app,
    SwaggerModule.createDocument(app, config),
  );
}
