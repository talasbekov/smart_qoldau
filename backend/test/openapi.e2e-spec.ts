import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createApp } from './utils/create-app';

describe('OpenAPI (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp(Test.createTestingModule({ imports: [AppModule] }));
  });
  afterAll(() => app.close());

  it('спека содержит все эндпоинты E1', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/docs-json')
      .expect(200);
    const paths = Object.keys(res.body.paths);
    for (const p of [
      '/v1/health',
      '/v1/topics',
      '/v1/auth/request-code',
      '/v1/auth/verify-code',
      '/v1/auth/refresh',
      '/v1/auth/guest',
      '/v1/auth/guest/convert',
    ])
      expect(paths).toContain(p);
  });
});
