import { INestApplication } from '@nestjs/common';
import request from 'supertest';

export interface ClientAuth {
  accessToken: string;
  userId: string;
}

// Обычный клиент: request-code -> verify-code. Вызывающий спек передаёт
// lastCodeGetter — геттер последнего кода, полученного его FakeSmsProvider.
export async function clientUser(
  app: INestApplication,
  phone: string,
  lastCodeGetter: () => string,
): Promise<ClientAuth> {
  await request(app.getHttpServer())
    .post('/v1/auth/request-code')
    .send({ phone })
    .expect(204);
  const res = await request(app.getHttpServer())
    .post('/v1/auth/verify-code')
    .send({ phone, code: lastCodeGetter() })
    .expect(200);
  return { accessToken: res.body.accessToken, userId: res.body.user.id };
}

// Гостевой клиент: вход по deviceId, без телефона.
export async function guestClient(
  app: INestApplication,
  deviceId: string,
): Promise<ClientAuth> {
  const res = await request(app.getHttpServer())
    .post('/v1/auth/guest')
    .send({ deviceId })
    .expect(200);
  return { accessToken: res.body.accessToken, userId: res.body.user.id };
}
