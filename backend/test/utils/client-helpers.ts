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
  const auth = { accessToken: res.body.accessToken, userId: res.body.user.id };
  // Р-27: обычный клиент — тот, кто прошёл экран согласия. Без него
  // заявки не создаются, и тесты про подбор проверяли бы гейт, а не
  // подбор. Сам гейт покрыт отдельным тестом с несогласившимся клиентом.
  await acceptExpertVisibility(app, auth.accessToken);
  return auth;
}

// Р-27: согласие, что психолог видит имя и историю встреч.
export async function acceptExpertVisibility(
  app: INestApplication,
  accessToken: string,
  displayName = 'Тестовый клиент',
): Promise<void> {
  await request(app.getHttpServer())
    .post('/v1/me/expert-visibility')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ displayName })
    .expect(200);
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
  const auth = { accessToken: res.body.accessToken, userId: res.body.user.id };
  await acceptExpertVisibility(app, auth.accessToken, 'Гость');
  return auth;
}
