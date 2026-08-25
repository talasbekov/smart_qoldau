import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { createApp } from './utils/create-app';

// E8: панель admin/ — браузерный SPA на другом origin (Vite dev, обычно
// :5173) должен уметь обратиться к API. Без app.enableCors() браузер
// блокирует кросс-origin ответ ещё до того, как код фронтенда его увидит.
describe('CORS (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const builder = Test.createTestingModule({ imports: [AppModule] });
    app = await createApp(builder);
  });

  afterAll(async () => {
    await app.close();
  });

  it('отдаёт Access-Control-Allow-Origin для разрешённого origin (admin/ dev-сервер)', async () => {
    const response = await request(app.getHttpServer())
      .options('/v1/admin/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('НЕ отдаёт Access-Control-Allow-Origin для постороннего origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/v1/admin/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
