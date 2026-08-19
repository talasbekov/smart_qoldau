import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createApp } from './utils/create-app';

describe('Errors (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp(Test.createTestingModule({ imports: [AppModule] }));
  });
  afterAll(() => app.close());

  it('404 в едином формате', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/no-such-route')
      .expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(typeof res.body.error.message).toBe('string');
  });
});
