import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createApp } from './utils/create-app';

describe('Health (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp(Test.createTestingModule({ imports: [AppModule] }));
  });
  afterAll(() => app.close());

  it('GET /v1/health -> {status:"ok", db:"ok", redis:"ok"}', () =>
    request(app.getHttpServer())
      .get('/v1/health')
      .expect(200)
      .expect({ status: 'ok', db: 'ok', redis: 'ok' }));
});
