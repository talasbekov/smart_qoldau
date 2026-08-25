import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import {
  registeredExpertUser,
  putScheduleAlwaysOn,
} from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// ТЗ §11.7: «все статусные переходы — в audit_log; логи доступа к
// метаданным консультаций ведутся». Переходы логировались с E4, ЧТЕНИЕ —
// нет (пробел найден при прогоне критериев приёмки E11, заведён в Plane).
// Спек фиксирует четыре вида доступа (карточка, список, переписка,
// заметка), схлопывание повторов в окне и то, что отказанный доступ
// (404 чужому) в журнал не попадает.
// Номера не пересекаются с другими спеками: +77109xxxxx свободен.
const PH_E1 = '+77109000001';
const PH_C1 = '+77109000091';
const PH_C2 = '+77109000092';
const ALL_PHONES = [PH_E1, PH_C1, PH_C2];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

let app: INestApplication;

function get(token: string, url: string) {
  return request(app.getHttpServer())
    .get(url)
    .set('Authorization', `Bearer ${token}`);
}
function post(token: string, url: string) {
  return request(app.getHttpServer())
    .post(url)
    .set('Authorization', `Bearer ${token}`);
}

describe('Журнал доступа к метаданным консультаций (ТЗ §11.7)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  const registeredExpertIds: string[] = [];
  const clientUserIds: string[] = [];

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
    if (clientUserIds.length) {
      await redis.del(...clientUserIds.map((id) => `abuse:client:${id}`));
    }
    // Окно дедупликации access-логов живёт в Redis и переживёт тест —
    // без сброса второй тест не увидел бы своей первой записи.
    const dedupKeys = await redis.keys('audit:access:*');
    if (dedupKeys.length) await redis.del(...dedupKeys);

    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entity: 'request' },
          { entity: 'offer' },
          { entity: 'consultation' },
          { entity: 'consultation_list' },
          { entity: 'expert', entityId: { in: expertIds } },
        ],
      },
    });
    await prisma.chatMessage.deleteMany({
      where: { consultation: { clientUserId: { in: userIds } } },
    });
    await prisma.expertNote.deleteMany({
      where: { consultation: { clientUserId: { in: userIds } } },
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
    clientUserIds.length = 0;
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] }).overrideProvider(
        SMS_PROVIDER_TOKEN,
      ).useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
  });

  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function acceptingExpert(phone: string) {
    const result = await registeredExpertUser(app, phone, () => lastCode);
    registeredExpertIds.push(result.expertId);
    await prisma.expert.update({
      where: { id: result.expertId },
      data: { verificationStatus: 'VERIFIED' },
    });
    await request(app.getHttpServer())
      .patch('/v1/experts/me/work-status')
      .set('Authorization', `Bearer ${result.accessToken}`)
      .send({ workStatus: 'ACCEPTING' })
      .expect(200);
    await putScheduleAlwaysOn(app, result.accessToken);
    return result;
  }

  async function clientUser(phone: string) {
    const result = await clientUserHelper(app, phone, () => lastCode);
    clientUserIds.push(result.userId);
    return result;
  }

  // Матч клиента с экспертом -> ACTIVE-консультация.
  async function activeConsultation(
    cli: { accessToken: string },
    exp: { accessToken: string },
  ) {
    await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'chat' })
      .expect(201);
    const offers = await get(exp.accessToken, '/v1/experts/me/offers').expect(
      200,
    );
    const accepted = await post(
      exp.accessToken,
      `/v1/offers/${offers.body[0].offerId as string}/accept`,
    ).expect(200);
    return accepted.body.consultationId as string;
  }

  function accessRows(transition: string, entityId?: string) {
    return prisma.auditLog.findMany({
      where: { transition, ...(entityId ? { entityId } : {}) },
      orderBy: { createdAt: 'asc' },
    });
  }

  it('чтение карточки консультации пишет consultation.metadata_read', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const consultationId = await activeConsultation(cli, exp);

    await get(cli.accessToken, `/v1/consultations/${consultationId}`).expect(
      200,
    );

    const rows = await accessRows('consultation.metadata_read', consultationId);
    expect(rows).toHaveLength(1);
    expect(rows[0].actorType).toBe('user');
    expect(rows[0].actorId).toBe(cli.userId);
    expect(rows[0].entity).toBe('consultation');
  });

  it('повторное чтение в окне дедупликации не плодит записи', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const consultationId = await activeConsultation(cli, exp);

    await get(cli.accessToken, `/v1/consultations/${consultationId}`).expect(200);
    await get(cli.accessToken, `/v1/consultations/${consultationId}`).expect(200);
    await get(cli.accessToken, `/v1/consultations/${consultationId}`).expect(200);

    const rows = await accessRows('consultation.metadata_read', consultationId);
    expect(rows).toHaveLength(1);
  });

  it('клиент и эксперт учитываются отдельно, роль видна в actorType', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const consultationId = await activeConsultation(cli, exp);

    await get(cli.accessToken, `/v1/consultations/${consultationId}`).expect(200);
    await get(exp.accessToken, `/v1/consultations/${consultationId}`).expect(200);

    const rows = await accessRows('consultation.metadata_read', consultationId);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.actorType).sort()).toEqual(['expert', 'user']);
  });

  it('чтение переписки пишет отдельный вид доступа consultation.messages_read', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const consultationId = await activeConsultation(cli, exp);

    await get(
      cli.accessToken,
      `/v1/consultations/${consultationId}/messages`,
    ).expect(200);

    const messages = await accessRows(
      'consultation.messages_read',
      consultationId,
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].actorId).toBe(cli.userId);
    // Карточку клиент не открывал — отдельный вид доступа не «слипся» с ней.
    const metadata = await accessRows(
      'consultation.metadata_read',
      consultationId,
    );
    expect(metadata).toHaveLength(0);
  });

  it('чтение приватной заметки экспертом пишет consultation.note_read', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const consultationId = await activeConsultation(cli, exp);

    await get(
      exp.accessToken,
      `/v1/consultations/${consultationId}/note`,
    ).expect(200);

    const rows = await accessRows('consultation.note_read', consultationId);
    expect(rows).toHaveLength(1);
    expect(rows[0].actorType).toBe('expert');
  });

  it('чтение списка своих консультаций пишет consultation.list_read', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    await activeConsultation(cli, exp);

    await get(cli.accessToken, '/v1/consultations').expect(200);

    const rows = await accessRows('consultation.list_read', cli.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0].entity).toBe('consultation_list');
    expect(rows[0].payload).toMatchObject({ as: 'client', count: 1 });
  });

  it('отказанный доступ (404 чужому) в журнал не попадает', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const stranger = await clientUser(PH_C2);
    const consultationId = await activeConsultation(cli, exp);

    await get(
      stranger.accessToken,
      `/v1/consultations/${consultationId}`,
    ).expect(404);

    const rows = await accessRows('consultation.metadata_read', consultationId);
    expect(rows).toHaveLength(0);
  });
});
