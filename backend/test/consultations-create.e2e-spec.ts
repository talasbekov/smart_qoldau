import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { PresenceService } from '../src/presence/presence.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { RequestsService } from '../src/requests/requests.service';
import { ConsultationsService } from '../src/consultations/consultations.service';
import { createApp } from './utils/create-app';
import { acceptingExpert as acceptingExpertHelper } from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Номера спека задачи 2 (E4), не пересекаются с другими спеками.
const PH_E1 = '+77082000001';
const PH_E2 = '+77082000002';
const PH_C1 = '+77082000091';
const PH_C2 = '+77082000092';
const PH_C3 = '+77082000093';
const PH_C4 = '+77082000094'; // «чужой» пользователь в тесте 404
const PH_C5 = '+77082000095';
const PH_C6 = '+77082000096';
const ALL_PHONES = [PH_E1, PH_E2, PH_C1, PH_C2, PH_C3, PH_C4, PH_C5, PH_C6];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

function post(token: string, url: string) {
  return request(app.getHttpServer())
    .post(url)
    .set('Authorization', `Bearer ${token}`);
}
function get(token: string, url: string) {
  return request(app.getHttpServer())
    .get(url)
    .set('Authorization', `Bearer ${token}`);
}

let app: INestApplication;

describe('Консультация из матча: атомарное создание, авто-BUSY (E4, задача 2, Р-13)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  let presence: PresenceService;
  const registeredExpertIds: string[] = [];

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const experts = await prisma.expert.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const expertIds = experts.map((e) => e.id);
    if (registeredExpertIds.length) {
      await redis.srem('experts:available', ...registeredExpertIds);
      await redis.hdel('experts:lastseen', ...registeredExpertIds);
    }
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entity: 'request' },
          { entity: 'offer' },
          { entity: 'consultation' },
          { entity: 'expert', entityId: { in: expertIds } },
        ],
      },
    });
    await prisma.consultation.deleteMany({
      where: {
        OR: [
          { expertId: { in: expertIds } },
          { clientUserId: { in: userIds } },
        ],
      },
    });
    await prisma.requestCandidate.deleteMany({
      where: {
        OR: [
          { expertId: { in: expertIds } },
          { request: { clientUserId: { in: userIds } } },
        ],
      },
    });
    await prisma.request.deleteMany({
      where: { clientUserId: { in: userIds } },
    });
    await prisma.expertScheduleDay.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expertDocument.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expertTopic.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expert.deleteMany({ where: { id: { in: expertIds } } });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...userIds, ...expertIds] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    registeredExpertIds.length = 0;
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    presence = app.get(PresenceService);
  });

  beforeEach(() => cleanup());

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function acceptingExpert(
    phone: string,
    overrides: { topics?: string[]; formats?: string[] } = {},
  ) {
    const result = await acceptingExpertHelper(
      app,
      phone,
      () => lastCode,
      overrides,
    );
    registeredExpertIds.push(result.expertId);
    return result;
  }

  async function clientUser(phone: string) {
    return clientUserHelper(app, phone, () => lastCode);
  }

  async function matchClientToExpert(
    cli: { accessToken: string },
    exp: { accessToken: string; expertId: string },
  ) {
    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
    const offers = await get(exp.accessToken, '/v1/experts/me/offers').expect(
      200,
    );
    const offerId = offers.body[0].offerId as string;
    const accepted = await post(
      exp.accessToken,
      `/v1/offers/${offerId}/accept`,
    ).expect(200);
    return { requestId: r.body.id as string, accepted: accepted.body };
  }

  it('accept создаёт консультацию, эксперт становится BUSY и выпадает из presence', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);

    expect(await presence.isAvailable(exp.expertId)).toBe(true);

    const { requestId, accepted } = await matchClientToExpert(cli, exp);
    expect(accepted.status).toBe('MATCHED');
    expect(accepted.consultationId).toBeDefined();

    // Эксперт стал BUSY в БД и выпал из presence (Redis).
    const expertRow = await prisma.expert.findUniqueOrThrow({
      where: { id: exp.expertId },
    });
    expect(expertRow.workStatus).toBe('BUSY');
    expect(await presence.isAvailable(exp.expertId)).toBe(false);

    // Консультация создана ровно одна для этой заявки, снапшот полей верен.
    const consultations = await prisma.consultation.findMany({
      where: { requestId },
    });
    expect(consultations.length).toBe(1);
    const consultation = consultations[0];
    expect(consultation.expertId).toBe(exp.expertId);
    expect(consultation.clientUserId).toBe(cli.userId);
    expect(consultation.format).toBe('video');
    expect(consultation.isEmergency).toBe(false);
    expect(consultation.status).toBe('ACTIVE');
    expect(consultation.startedAt).toBeInstanceOf(Date);

    // Аудит: consultation.created + expert.work_status_changed (system).
    const consultationAudit = await prisma.auditLog.findFirst({
      where: {
        entity: 'consultation',
        entityId: consultation.id,
        transition: 'consultation.created',
      },
    });
    expect(consultationAudit).not.toBeNull();
    expect(consultationAudit!.actorType).toBe('system');

    const workStatusAudit = await prisma.auditLog.findFirst({
      where: {
        entity: 'expert',
        entityId: exp.expertId,
        transition: 'expert.work_status_changed',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(workStatusAudit).not.toBeNull();
    expect(workStatusAudit!.actorType).toBe('system');
    expect(workStatusAudit!.payload).toMatchObject({
      from: 'ACCEPTING',
      to: 'BUSY',
    });
  });

  it('клиент видит consultationId в статусе своей MATCHED-заявки', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C2);

    const { requestId, accepted } = await matchClientToExpert(cli, exp);

    const status = await get(
      cli.accessToken,
      `/v1/requests/${requestId}`,
    ).expect(200);
    expect(status.body.status).toBe('MATCHED');
    expect(status.body.consultationId).toBe(accepted.consultationId);
  });

  it('GET /v1/consultations/:id — клиент видит ConsultationClientDto без PII эксперта, эксперт видит ConsultationExpertDto без PII клиента, чужой — 404', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C3);
    const stranger = await clientUser(PH_C4);

    const { accepted } = await matchClientToExpert(cli, exp);
    const consultationId = accepted.consultationId as string;

    const clientView = await get(
      cli.accessToken,
      `/v1/consultations/${consultationId}`,
    ).expect(200);
    expect(clientView.body).toMatchObject({
      id: consultationId,
      status: 'ACTIVE',
      format: 'video',
      isEmergency: false,
    });
    expect(clientView.body.expert).toMatchObject({
      id: exp.expertId,
      displayName: expect.any(String),
    });
    expect(clientView.body.expert.userId).toBeUndefined();
    expect(clientView.body.priceTiyn).toBeGreaterThan(0);
    expect(clientView.body.plannedDurationMin).toBe(50);
    expect(clientView.body.clientCode).toBeUndefined();
    expect(clientView.body.topicSlug).toBeUndefined();

    const expertView = await get(
      exp.accessToken,
      `/v1/consultations/${consultationId}`,
    ).expect(200);
    expect(expertView.body).toMatchObject({
      id: consultationId,
      status: 'ACTIVE',
      format: 'video',
      isEmergency: false,
      topicSlug: 'anxiety-stress',
    });
    expect(expertView.body.clientCode).toBeGreaterThanOrEqual(1000);
    expect(JSON.stringify(expertView.body)).not.toMatch(/\+77\d{9}/);
    expect(expertView.body.clientUserId).toBeUndefined();
    expect(expertView.body.expert).toBeUndefined();

    const strangerRes = await get(
      stranger.accessToken,
      `/v1/consultations/${consultationId}`,
    ).expect(404);
    expect(strangerRes.body.error.code).toBe('CONSULTATION_NOT_FOUND');
  });

  it('повторный accept-ретрай (гонка) не создаёт дубль консультации по requestId', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C5);

    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
    const offers = await get(exp.accessToken, '/v1/experts/me/offers').expect(
      200,
    );
    const offerId = offers.body[0].offerId as string;

    const requestsService = app.get(RequestsService);
    const [res1, res2] = await Promise.all([
      requestsService.claimOffer(offerId, exp.expertId).catch((e) => e),
      requestsService.claimOffer(offerId, exp.expertId).catch((e) => e),
    ]);

    // Ровно один вызов доходит до успешного пути claimOffer (второй ловит
    // OFFER_ALREADY_TAKEN на updateMany PENDING->ACCEPTED раньше, чем
    // возникнет реальная гонка внутри createFromMatch) — но даже если бы оба
    // прошли гейт (P2002-идемпотентность createFromMatch), в БД должна
    // остаться ровно одна консультация на заявку.
    const succeeded = [res1, res2].filter(
      (r) => r && typeof r === 'object' && 'consultationId' in r,
    );
    expect(succeeded.length).toBeGreaterThanOrEqual(1);

    const consultations = await prisma.consultation.findMany({
      where: { requestId: r.body.id },
    });
    expect(consultations.length).toBe(1);
  });

  it('сбой создания консультации откатывает весь матч: оффер снова PENDING, заявка SEARCHING, повторный accept успешен', async () => {
    const exp = await acceptingExpert(PH_E2);
    const cli = await clientUser(PH_C6);

    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
    const offers = await get(exp.accessToken, '/v1/experts/me/offers').expect(
      200,
    );
    const offerId = offers.body[0].offerId as string;

    // Первый вызов createFromMatch падает внутри транзакции матча.
    const consultationsService = app.get(ConsultationsService);
    const spy = jest
      .spyOn(consultationsService, 'createFromMatch')
      .mockRejectedValueOnce(new Error('transient db error'));

    await post(exp.accessToken, `/v1/offers/${offerId}/accept`).expect(500);

    // Транзакция откатилась целиком: консультации нет, заявка SEARCHING,
    // оффер снова PENDING, эксперт НЕ BUSY — «MATCHED без консультации»
    // не существует как наблюдаемое состояние (окно денег E5 закрыто).
    expect(
      await prisma.consultation.count({ where: { requestId: r.body.id } }),
    ).toBe(0);
    const requestRow = await prisma.request.findUniqueOrThrow({
      where: { id: r.body.id },
    });
    expect(requestRow.status).toBe('SEARCHING');
    expect(requestRow.matchedExpertId).toBeNull();
    const offerRow = await prisma.requestCandidate.findUniqueOrThrow({
      where: { id: offerId },
    });
    expect(offerRow.response).toBe('PENDING');
    const expertRow = await prisma.expert.findUniqueOrThrow({
      where: { id: exp.expertId },
    });
    expect(expertRow.workStatus).toBe('ACCEPTING');

    // Повторный accept (spy отработал once — дальше оригинал) успешен.
    const retry = await post(
      exp.accessToken,
      `/v1/offers/${offerId}/accept`,
    ).expect(200);
    expect(retry.body.status).toBe('MATCHED');
    expect(retry.body.consultationId).toBeDefined();
    expect(
      await prisma.consultation.count({ where: { requestId: r.body.id } }),
    ).toBe(1);
    const expertAfter = await prisma.expert.findUniqueOrThrow({
      where: { id: exp.expertId },
    });
    expect(expertAfter.workStatus).toBe('BUSY');

    spy.mockRestore();
  });
});
