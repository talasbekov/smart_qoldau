import {
  holdConsultation,
  cleanupPaidConsultations,
} from './utils/paid-consultation';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { acceptingExpert as acceptingExpertHelper } from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Удаление аккаунта и данных по запросу (ТЗ §5.1, политика
// конфиденциальности лендинга: «через настройки профиля или обратившись в
// поддержку»).
//
// Спек фиксирует границу: что обязано исчезнуть (переписка, заметки,
// устройства, уведомления, избранное, карты, тексты отзывов, телефон) и
// что обязано остаться (консультации, платежи, проводки, audit_log) —
// финансовый учёт нельзя терять по запросу одной из сторон.
//
// Свой диапазон номеров, не пересекается с другими спеками.
const PH_E1 = '+77087000001';
const PH_C1 = '+77087000091';
const PH_C2 = '+77087000092';
const ALL_PHONES = [PH_E1, PH_C1, PH_C2];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    lastCode = match ? match[1] : '';
  }
}

let app: INestApplication;

function authed(method: 'get' | 'post' | 'delete', token: string, url: string) {
  return request(app.getHttpServer())
    [method](url)
    .set('Authorization', `Bearer ${token}`);
}

describe('Удаление аккаунта по запросу (ТЗ §5.1)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  const registeredExpertIds: string[] = [];

  async function cleanup() {
    await cleanupPaidConsultations(app);
    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    // Удалённые аккаунты теряют телефон, поэтому чистим и по «осиротевшим»
    // консультациям экспертов спека — иначе прогон за прогоном копил бы их.
    const userIds = users.map((u) => u.id);
    const experts = await prisma.expert.findMany({
      where: {
        OR: [{ userId: { in: userIds } }, { id: { in: registeredExpertIds } }],
      },
      select: { id: true, userId: true },
    });
    const expertIds = experts.map((e) => e.id);
    const allUserIds = [
      ...new Set([...userIds, ...experts.map((e) => e.userId)]),
    ];
    const consultations = await prisma.consultation.findMany({
      where: {
        OR: [
          { expertId: { in: expertIds } },
          { clientUserId: { in: allUserIds } },
        ],
      },
      select: { id: true },
    });
    const consultationIds = consultations.map((c) => c.id);
    if (registeredExpertIds.length) {
      await redis.srem('experts:available', ...registeredExpertIds);
      await redis.hdel('experts:lastseen', ...registeredExpertIds);
    }

    await prisma.chatMessage.deleteMany({
      where: { consultationId: { in: consultationIds } },
    });
    await prisma.expertNote.deleteMany({
      where: { consultationId: { in: consultationIds } },
    });
    await prisma.review.deleteMany({
      where: { consultationId: { in: consultationIds } },
    });
    await prisma.payment.deleteMany({
      where: { consultationId: { in: consultationIds } },
    });
    await prisma.consultation.deleteMany({
      where: { id: { in: consultationIds } },
    });
    await prisma.requestCandidate.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.request.deleteMany({
      where: { clientUserId: { in: allUserIds } },
    });
    await prisma.notification.deleteMany({
      where: { userId: { in: allUserIds } },
    });
    await prisma.device.deleteMany({ where: { userId: { in: allUserIds } } });
    await prisma.favorite.deleteMany({ where: { userId: { in: allUserIds } } });
    await prisma.paymentMethod.deleteMany({
      where: { userId: { in: allUserIds } },
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
      where: { userId: { in: allUserIds } },
    });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
    await prisma.auditLog.deleteMany({
      where: {
        entityId: { in: [...allUserIds, ...expertIds, ...consultationIds] },
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: allUserIds } } });
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
  });

  beforeEach(() => cleanup());

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  /// Клиент с завершённой консультацией: переписка, отзыв, карта,
  /// устройство, избранное — то есть всё, что удаление обязано разобрать.
  async function clientWithHistory() {
    const expert = await acceptingExpertHelper(app, PH_E1, () => lastCode);
    registeredExpertIds.push(expert.expertId);
    const client = await clientUserHelper(app, PH_C1, () => lastCode);

    const requestRes = await authed('post', client.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'chat' })
      .expect(201);
    const offers = await authed(
      'get',
      expert.accessToken,
      '/v1/experts/me/offers',
    ).expect(200);
    const accepted = await authed(
      'post',
      expert.accessToken,
      `/v1/offers/${offers.body[0].offerId}/accept`,
    ).expect(200);
    const consultationId = accepted.body.consultationId as string;
    await holdConsultation(app, consultationId);

    await prisma.chatMessage.create({
      data: {
        consultationId,
        senderRole: 'client',
        ciphertext: Buffer.from('шифртекст'),
      },
    });
    await prisma.expertNote.create({
      data: {
        consultationId,
        expertId: expert.expertId,
        ciphertext: Buffer.from('заметка эксперта о клиенте'),
      },
    });
    await prisma.device.create({
      data: {
        userId: client.userId,
        platform: 'android',
        token: `del-e2e-${client.userId}`,
      },
    });
    await prisma.notification.create({
      data: {
        userId: client.userId,
        type: 'consultation.reminder',
        title: 'Напоминание',
        body: 'Через 15 минут',
        data: {},
      },
    });
    await prisma.favorite.create({
      data: { userId: client.userId, expertId: expert.expertId },
    });
    await prisma.paymentMethod.create({
      data: {
        userId: client.userId,
        providerToken: 'tok_del_e2e',
        maskedPan: '**** 4521',
        brand: 'visa',
        holderName: 'IVAN IVANOV',
      },
    });

    await authed(
      'post',
      expert.accessToken,
      `/v1/consultations/${consultationId}/complete`,
    )
      .send({ outcome: 'COMPLETED' })
      .expect(200);

    await authed(
      'post',
      client.accessToken,
      `/v1/consultations/${consultationId}/review`,
    )
      .send({ rating: 5, publicText: 'Помогло', privateText: 'Спасибо' })
      .expect(201);

    return { expert, client, consultationId, requestId: requestRes.body.id };
  }

  it('DELETE /v1/me вычищает данные пользователя, но оставляет учётные записи консультаций', async () => {
    const { client, consultationId } = await clientWithHistory();

    await authed('delete', client.accessToken, '/v1/me').expect(204);

    // Телефон освобождён, PII вычищен, аккаунт помечен удалённым.
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: client.userId },
    });
    expect(row.phone).toBeNull();
    expect(row.deviceId).toBeNull();
    expect(row.deletedAt).not.toBeNull();

    // Содержательные данные исчезли.
    expect(await prisma.chatMessage.count({ where: { consultationId } })).toBe(
      0,
    );
    expect(await prisma.expertNote.count({ where: { consultationId } })).toBe(
      0,
    );
    expect(
      await prisma.device.count({ where: { userId: client.userId } }),
    ).toBe(0);
    expect(
      await prisma.notification.count({ where: { userId: client.userId } }),
    ).toBe(0);
    expect(
      await prisma.favorite.count({ where: { userId: client.userId } }),
    ).toBe(0);
    expect(
      await prisma.paymentMethod.count({ where: { userId: client.userId } }),
    ).toBe(0);
    expect(
      await prisma.refreshToken.count({
        where: { userId: client.userId, revokedAt: null },
      }),
    ).toBe(0);

    // Отзыв остаётся как факт оценки (рейтинг эксперта пересчитывать
    // задним числом нельзя), но тексты пользователя из него убраны.
    const review = await prisma.review.findUniqueOrThrow({
      where: { consultationId },
    });
    expect(review.rating).toBe(5);
    expect(review.publicText).toBeNull();
    expect(review.privateText).toBeNull();

    // Учётные записи на месте: консультация и её финансовый след.
    expect(
      await prisma.consultation.count({ where: { id: consultationId } }),
    ).toBe(1);

    // Событие удаления записано в журнал.
    const audit = await prisma.auditLog.findFirst({
      where: {
        entity: 'user',
        entityId: client.userId,
        transition: 'user.deleted',
      },
    });
    expect(audit).not.toBeNull();
  });

  it('повторный вход по тому же номеру заводит новый аккаунт, а не воскрешает удалённый', async () => {
    const { client } = await clientWithHistory();
    await authed('delete', client.accessToken, '/v1/me').expect(204);

    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone: PH_C1 })
      .expect(204);
    const again = await request(app.getHttpServer())
      .post('/v1/auth/verify-code')
      .send({ phone: PH_C1, code: lastCode })
      .expect(200);

    expect(again.body.user.id).not.toBe(client.userId);
    expect(again.body.user.phone).toBe(PH_C1);
  });

  it('удаление во время активной консультации отклоняется', async () => {
    const expert = await acceptingExpertHelper(app, PH_E1, () => lastCode);
    registeredExpertIds.push(expert.expertId);
    const client = await clientUserHelper(app, PH_C2, () => lastCode);

    await authed('post', client.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'chat' })
      .expect(201);
    const offers = await authed(
      'get',
      expert.accessToken,
      '/v1/experts/me/offers',
    ).expect(200);
    await authed(
      'post',
      expert.accessToken,
      `/v1/offers/${offers.body[0].offerId}/accept`,
    ).expect(200);

    const res = await authed('delete', client.accessToken, '/v1/me').expect(
      409,
    );
    expect(res.body.error.code).toBe('CONSULTATION_IN_PROGRESS');

    const row = await prisma.user.findUniqueOrThrow({
      where: { id: client.userId },
    });
    expect(row.deletedAt).toBeNull();
  });

  it('специалисту удаление через API закрыто — у него обязательства и выплаты', async () => {
    const expert = await acceptingExpertHelper(app, PH_E1, () => lastCode);
    registeredExpertIds.push(expert.expertId);

    const res = await authed('delete', expert.accessToken, '/v1/me').expect(
      409,
    );
    expect(res.body.error.code).toBe('EXPERT_DELETE_VIA_SUPPORT');
  });

  it('без токена — 401', async () => {
    await request(app.getHttpServer()).delete('/v1/me').expect(401);
  });
});
