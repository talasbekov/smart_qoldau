import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Topics (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterAll(() => app.close());

  it('GET /v1/topics -> 12 тем на русском по умолчанию', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/topics')
      .expect(200);
    expect(res.body).toHaveLength(12);
    expect(res.body[0]).toEqual({
      id: expect.any(String),
      slug: 'anxiety-stress',
      name: 'Тревога и стресс',
    });
  });

  it('GET /v1/topics?locale=kz -> казахские названия', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/topics?locale=kz')
      .expect(200);
    expect(res.body[0].name).toBe('Мазасыздық және стресс');
  });
});
