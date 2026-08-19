import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });
  afterAll(() => app.close());

  it('GET /v1/health -> {status:"ok"}', () =>
    request(app.getHttpServer()).get('/v1/health').expect(200).expect({ status: 'ok' }));
});
