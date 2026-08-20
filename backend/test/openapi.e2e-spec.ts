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
      '/v1/experts',
      '/v1/experts/{id}',
      '/v1/experts/me',
      '/v1/experts/me/work-status',
      '/v1/experts/me/heartbeat',
      '/v1/experts/me/schedule',
      '/v1/experts/me/availability',
      '/v1/experts/me/documents/{type}',
      '/v1/experts/me/documents',
      '/v1/experts/me/documents/submit',
      '/v1/admin/verification/queue',
      '/v1/admin/verification/documents/{documentId}/decision',
      '/v1/admin/verification/{expertId}/decision',
      '/v1/admin/experts/{expertId}/block',
      '/v1/admin/experts/{expertId}/unblock',
      '/v1/requests',
      '/v1/requests/{id}',
      '/v1/requests/{id}/cancel',
      '/v1/experts/me/offers',
      '/v1/offers/{offerId}/accept',
      '/v1/offers/{offerId}/decline',
      '/v1/favorites',
      '/v1/favorites/{expertId}',
      '/v1/consultations',
      '/v1/consultations/{id}',
      '/v1/consultations/{id}/messages',
      '/v1/consultations/{id}/media-token',
      '/v1/consultations/{id}/complete',
      '/v1/consultations/{id}/cancel',
      '/v1/webhooks/livekit',
    ])
      expect(paths).toContain(p);
  });
});
