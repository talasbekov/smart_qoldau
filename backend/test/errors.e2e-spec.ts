import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AppExceptionFilter } from '../src/common/filters/app-exception.filter';

describe('Errors (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
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
    await app.init();
  });
  afterAll(() => app.close());

  it('404 в едином формате', async () => {
    const res = await request(app.getHttpServer()).get('/v1/no-such-route').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(typeof res.body.error.message).toBe('string');
  });
});
