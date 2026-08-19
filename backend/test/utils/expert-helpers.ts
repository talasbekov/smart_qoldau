import { INestApplication } from '@nestjs/common';
import request from 'supertest';

const ADMIN = { 'X-Admin-Token': 'dev-admin-token-0123456789abcdef' };

const DOC_TYPES = ['IDENTITY', 'DIPLOMA', 'CERTIFICATES', 'QUALIFICATION'];

const DEFAULT_EXPERT_DTO = {
  displayName: 'Айгуль С.',
  city: 'Алматы',
  experience: 'FIVE_TO_TEN',
  education: 'КазНУ им. аль-Фараби',
  priceTiyn: 399000,
  languages: ['ru', 'kz'],
  formats: ['chat', 'audio', 'video'],
  topicSlugs: ['anxiety-stress', 'burnout'],
};

export interface RegisteredAuth {
  accessToken: string;
  refreshToken: string;
  user: { id: string; phone: string; isGuest: boolean };
}

export interface ExpertProfileOverrides {
  topics?: string[];
  formats?: string[];
}

// register -> verify-code (lastCode получает вызывающий спек через свой
// FakeSmsProvider). Общий базовый логин-хелпер эпика.
export async function registeredUser(
  app: INestApplication,
  phone: string,
  lastCode: string,
): Promise<RegisteredAuth> {
  const res = await request(app.getHttpServer())
    .post('/v1/auth/verify-code')
    .send({ phone, code: lastCode })
    .expect(200);
  return res.body as RegisteredAuth;
}

// register -> profile (DRAFT), с опциональными topics/formats.
export async function registeredExpertUser(
  app: INestApplication,
  phone: string,
  lastCodeGetter: () => string,
  overrides: ExpertProfileOverrides = {},
): Promise<{ accessToken: string; expertId: string }> {
  await request(app.getHttpServer())
    .post('/v1/auth/request-code')
    .send({ phone })
    .expect(204);
  const verifyRes = await request(app.getHttpServer())
    .post('/v1/auth/verify-code')
    .send({ phone, code: lastCodeGetter() })
    .expect(200);
  const accessToken = verifyRes.body.accessToken as string;

  const dto = {
    ...DEFAULT_EXPERT_DTO,
    ...(overrides.formats ? { formats: overrides.formats } : {}),
    ...(overrides.topics ? { topicSlugs: overrides.topics } : {}),
  };

  const profile = await request(app.getHttpServer())
    .post('/v1/experts')
    .set('Authorization', `Bearer ${accessToken}`)
    .send(dto)
    .expect(201);
  const expertId = profile.body.id as string;
  return { accessToken, expertId };
}

// registeredExpertUser + 4 документа + submit + админ-approve документов и
// анкеты -> VERIFIED.
export async function verifiedExpert(
  app: INestApplication,
  phone: string,
  lastCodeGetter: () => string,
  overrides: ExpertProfileOverrides = {},
): Promise<{ accessToken: string; expertId: string }> {
  const { accessToken, expertId } = await registeredExpertUser(
    app,
    phone,
    lastCodeGetter,
    overrides,
  );

  for (const type of DOC_TYPES) {
    await request(app.getHttpServer())
      .post(`/v1/experts/me/documents/${type}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', Buffer.from('%PDF-1.4 fake'), 'doc.pdf')
      .expect(201);
  }

  await request(app.getHttpServer())
    .post('/v1/experts/me/documents/submit')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  const queue = await request(app.getHttpServer())
    .get('/v1/admin/verification/queue')
    .set(ADMIN)
    .expect(200);
  const entry = queue.body.find((e: any) => e.id === expertId);
  const docIds: string[] = entry.documents.map((d: any) => d.id);

  for (const id of docIds) {
    await request(app.getHttpServer())
      .post(`/v1/admin/verification/documents/${id}/decision`)
      .set(ADMIN)
      .send({ approve: true })
      .expect(200);
  }
  await request(app.getHttpServer())
    .post(`/v1/admin/verification/${expertId}/decision`)
    .set(ADMIN)
    .send({ approve: true })
    .expect(200);

  return { accessToken, expertId };
}

const FULL_DAY_SCHEDULE = {
  days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    enabled: true,
    startMin: 0,
    endMin: 1440,
  })),
};

// расписание 24/7 на все 7 дней.
export async function putScheduleAlwaysOn(
  app: INestApplication,
  accessToken: string,
): Promise<void> {
  await request(app.getHttpServer())
    .put('/v1/experts/me/schedule')
    .set('Authorization', `Bearer ${accessToken}`)
    .send(FULL_DAY_SCHEDULE)
    .expect(200);
}

// расписание, где все 7 дней enabled:false -> эксперт всегда вне графика.
export async function putScheduleAllDisabled(
  app: INestApplication,
  accessToken: string,
): Promise<void> {
  await request(app.getHttpServer())
    .put('/v1/experts/me/schedule')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        weekday,
        enabled: false,
        startMin: 540,
        endMin: 1080,
      })),
    })
    .expect(200);
}

// verifiedExpert + ACCEPTING + расписание 24/7. Самый переиспользуемый
// хелпер эпика E3 — задачи 4-9 его импортируют напрямую.
export async function acceptingExpert(
  app: INestApplication,
  phone: string,
  lastCodeGetter: () => string,
  overrides: ExpertProfileOverrides = {},
): Promise<{ accessToken: string; expertId: string }> {
  const result = await verifiedExpert(app, phone, lastCodeGetter, overrides);
  await request(app.getHttpServer())
    .patch('/v1/experts/me/work-status')
    .set('Authorization', `Bearer ${result.accessToken}`)
    .send({ workStatus: 'ACCEPTING' })
    .expect(200);
  await putScheduleAlwaysOn(app, result.accessToken);
  return result;
}
