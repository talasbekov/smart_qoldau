import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { ClockService } from '../src/common/clock/clock.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import {
  registeredExpertUser,
  putScheduleAlwaysOn,
} from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Номера спека задачи 6 (E4): приватные заметки эксперта.
const PH_E1 = '+77083010001';
const PH_E2 = '+77083010002';
const PH_C1 = '+77083010091';
const PH_C2 = '+77083010092';
const ALL_PHONES = [PH_E1, PH_E2, PH_C1, PH_C2];

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
function put(token: string, url: string) {
  return request(app.getHttpServer())
    .put(url)
    .set('Authorization', `Bearer ${token}`);
}
function get(token: string, url: string) {
  return request(app.getHttpServer())
    .get(url)
    .set('Authorization', `Bearer ${token}`);
}

const fakeClock = {
  current: new Date('2026-08-20T05:00:00Z'),
  now(): Date {
    return new Date(this.current);
  },
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  },
};

let app: INestApplication;

describe('Приватные шифрованные заметки эксперта (E4, задача 6)', () => {
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
      const abuseKeys = clientUserIds.map((id) => `abuse:client:${id}`);
      await redis.del(...abuseKeys);
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
    await prisma.expertNote.deleteMany({
      where: { expertId: { in: expertIds } },
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
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider)
        .overrideProvider(ClockService)
        .useValue(fakeClock),
    );
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
  });

  beforeEach(async () => {
    fakeClock.current = new Date('2026-08-20T05:00:00Z');
    await cleanup();
  });

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

  async function matchClientToExpert(
    cli: { accessToken: string },
    exp: { accessToken: string; expertId: string },
  ) {
    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'chat' })
      .expect(201);
    const offers = await get(exp.accessToken, '/v1/experts/me/offers').expect(
      200,
    );
    const offerId = offers.body[0].offerId as string;
    const accepted = await post(
      exp.accessToken,
      `/v1/offers/${offerId}/accept`,
    ).expect(200);
    return {
      requestId: r.body.id as string,
      consultationId: accepted.body.consultationId as string,
    };
  }

  it('PUT создаёт заметку → GET возвращает (с trim, шифрование в БД)', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const { consultationId } = await matchClientToExpert(cli, exp);

    // PUT с пробелами на краях
    const noteText = '  Пациент жалуется на стресс  ';
    await put(exp.accessToken, `/v1/consultations/${consultationId}/note`)
      .send({ text: noteText })
      .expect(200);

    // GET возвращает trimmed текст
    const getRes = await get(
      exp.accessToken,
      `/v1/consultations/${consultationId}/note`,
    ).expect(200);
    expect(getRes.body).toHaveProperty('text');
    expect(getRes.body.text).toBe('Пациент жалуется на стресс');
    expect(getRes.body).toHaveProperty('updatedAt');

    // Проверяем что в БД ciphertext (raw)
    const note = await prisma.expertNote.findUnique({
      where: { consultationId },
    });
    expect(note).toBeDefined();
    // Prisma возвращает Uint8Array
    expect(note!.ciphertext).toBeInstanceOf(Uint8Array);
    // Убеждаемся что это не plaintext (не содержит исходный текст в plaintext)
    const ciphertextStr = Buffer.from(note!.ciphertext).toString('utf8');
    expect(ciphertextStr).not.toContain('Пациент жалуется');
  });

  it('PUT перезаписывает заметку (updatedAt меняется)', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const { consultationId } = await matchClientToExpert(cli, exp);

    const text1 = 'Первая версия заметки';
    await put(exp.accessToken, `/v1/consultations/${consultationId}/note`)
      .send({ text: text1 })
      .expect(200);

    const res1 = await get(
      exp.accessToken,
      `/v1/consultations/${consultationId}/note`,
    ).expect(200);
    const updatedAt1 = res1.body.updatedAt;

    fakeClock.advance(1000);

    const text2 = 'Вторая версия заметки';
    await put(exp.accessToken, `/v1/consultations/${consultationId}/note`)
      .send({ text: text2 })
      .expect(200);

    const res2 = await get(
      exp.accessToken,
      `/v1/consultations/${consultationId}/note`,
    ).expect(200);
    expect(res2.body.text).toBe(text2);
    expect(res2.body.updatedAt).not.toBe(updatedAt1);
    expect(new Date(res2.body.updatedAt).getTime()).toBeGreaterThan(
      new Date(updatedAt1).getTime(),
    );
  });

  it('GET без заметки возвращает {text: null}', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const { consultationId } = await matchClientToExpert(cli, exp);

    const res = await get(
      exp.accessToken,
      `/v1/consultations/${consultationId}/note`,
    ).expect(200);
    expect(res.body).toEqual({ text: null });
  });

  it('Клиент PUT/GET на заметку → 404 (заметка приватна)', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const { consultationId } = await matchClientToExpert(cli, exp);

    // Сначала эксперт создаёт заметку
    await put(exp.accessToken, `/v1/consultations/${consultationId}/note`)
      .send({ text: 'Заметка эксперта' })
      .expect(200);

    // Клиент пытается PUT
    await put(cli.accessToken, `/v1/consultations/${consultationId}/note`)
      .send({ text: 'Попытка клиента' })
      .expect(404);

    // Клиент пытается GET
    await get(
      cli.accessToken,
      `/v1/consultations/${consultationId}/note`,
    ).expect(404);
  });

  it('Чужой эксперт PUT/GET → 404', async () => {
    const exp1 = await acceptingExpert(PH_E1);
    const exp2 = await acceptingExpert(PH_E2);
    const cli = await clientUser(PH_C1);
    const { consultationId } = await matchClientToExpert(cli, exp1);

    // Эксперт 1 создаёт заметку
    await put(exp1.accessToken, `/v1/consultations/${consultationId}/note`)
      .send({ text: 'Заметка exp1' })
      .expect(200);

    // Эксперт 2 пытается PUT
    await put(exp2.accessToken, `/v1/consultations/${consultationId}/note`)
      .send({ text: 'Попытка exp2' })
      .expect(404);

    // Эксперт 2 пытается GET
    await get(
      exp2.accessToken,
      `/v1/consultations/${consultationId}/note`,
    ).expect(404);
  });

  it('Текст >5000 символов → 400', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const { consultationId } = await matchClientToExpert(cli, exp);

    const tooLongText = 'x'.repeat(5001);
    await put(exp.accessToken, `/v1/consultations/${consultationId}/note`)
      .send({ text: tooLongText })
      .expect(400);
  });

  it('PUT заметки на COMPLETED консультации работает', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const { consultationId } = await matchClientToExpert(cli, exp);

    // Эксперт завершает консультацию
    await post(exp.accessToken, `/v1/consultations/${consultationId}/complete`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);

    // Может создать/обновить заметку на COMPLETED
    const noteText = 'Заметка после завершения';
    await put(exp.accessToken, `/v1/consultations/${consultationId}/note`)
      .send({ text: noteText })
      .expect(200);

    const res = await get(
      exp.accessToken,
      `/v1/consultations/${consultationId}/note`,
    ).expect(200);
    expect(res.body.text).toBe(noteText);
  });

  it('audit консультации.note_updated БЕЗ текста заметки', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const { consultationId } = await matchClientToExpert(cli, exp);

    await put(exp.accessToken, `/v1/consultations/${consultationId}/note`)
      .send({ text: 'Секретная информация' })
      .expect(200);

    // Проверяем audit лог
    const logs = await prisma.auditLog.findMany({
      where: {
        entity: 'consultation',
        entityId: consultationId,
        transition: 'consultation.note_updated',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(logs.length).toBeGreaterThan(0);
    const log = logs[0];
    expect(log.actorType).toBe('expert');
    expect(log.actorId).toBe(exp.expertId);
    // Важно: payload НЕ содержит текст
    expect(log.payload).not.toContain('Секретная информация');
  });

  it('пустой текст (только пробелы) после trim → 400', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const { consultationId } = await matchClientToExpert(cli, exp);

    await put(exp.accessToken, `/v1/consultations/${consultationId}/note`)
      .send({ text: '   ' })
      .expect(400);
  });
});
