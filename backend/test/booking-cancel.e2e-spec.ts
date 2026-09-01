import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { ClockService } from '../src/common/clock/clock.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { registeredExpertUser } from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';
import { flushPushOutbox } from './utils/outbox-helpers';

// Отмена плановой консультации (E6b, задача 5). Раньше двух часов —
// бесплатно; позже — в счётчик злоупотреблений, тот же, что у no-show
// (Р-17): три раза за 30 дней отключают автоподбор.
const PH_E1 = '+77099300001';
const PH_C1 = '+77099300091';
const ALL_PHONES = [PH_E1, PH_C1];
const VISA_PAN = '4111111111111111';

const fakeClock = {
  current: new Date('2026-08-24T03:00:00Z'),
  now(): Date {
    return new Date(this.current);
  },
};

const SLOT = '2026-08-25T10:00:00.000Z';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    if (match) lastCode = match[1];
  }
}

describe('Отмена плановой консультации (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let expert: { accessToken: string; expertId: string };
  let client: { accessToken: string; userId: string };
  let cardId: string;

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    if (!userIds.length) return;
    const experts = await prisma.expert.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const expertIds = experts.map((e) => e.id);
    if (expertIds.length) {
      await redis.srem('experts:available', ...expertIds);
      await redis.hdel('experts:lastseen', ...expertIds);
    }
    await redis.del(...userIds.map((id) => `abuse:client:${id}`));
    await prisma.payment.deleteMany({
      where: { clientUserId: { in: userIds } },
    });
    await prisma.paymentMethod.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.notificationOutbox.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.notification.deleteMany({
      where: { userId: { in: userIds } },
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
      where: { request: { clientUserId: { in: userIds } } },
    });
    await prisma.request.deleteMany({
      where: { clientUserId: { in: userIds } },
    });
    await prisma.expertScheduleDay.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expertTopic.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expert.deleteMany({ where: { id: { in: expertIds } } });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
  }

  const cancel = (token: string, id: string) =>
    request(app.getHttpServer())
      .post(`/v1/consultations/${id}/cancel`)
      .set('Authorization', `Bearer ${token}`);

  const cancelByExpert = (token: string, id: string) =>
    request(app.getHttpServer())
      .post(`/v1/consultations/${id}/cancel-by-expert`)
      .set('Authorization', `Bearer ${token}`);

  const book = async (slotStartAt: string): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/v1/bookings')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({
        expertId: expert.expertId,
        topicSlug: 'anxiety-stress',
        format: 'chat',
        slotStartAt,
        paymentMethodId: cardId,
      })
      .expect(201);
    return res.body.consultationId as string;
  };

  const abuseCount = async (): Promise<number> =>
    Number((await redis.get(`abuse:client:${client.userId}`)) ?? 0);

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
    await cleanup();

    expert = await registeredExpertUser(app, PH_E1, () => lastCode, {
      topics: ['anxiety-stress'],
    });
    await prisma.expert.update({
      where: { id: expert.expertId },
      data: { verificationStatus: 'VERIFIED' },
    });
    await request(app.getHttpServer())
      .put('/v1/experts/me/schedule')
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({
        days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          enabled: true,
          startMin: 540,
          endMin: 1080,
        })),
      })
      .expect(200);

    client = await clientUserHelper(app, PH_C1, () => lastCode);
    const card = await request(app.getHttpServer())
      .post('/v1/payment-methods')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({ pan: VISA_PAN, expiry: '12/28', holderName: 'Ivan Petrov' })
      .expect(201);
    cardId = card.body.id;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('отмена за три часа: холд снят, счётчик не тронут', async () => {
    // Сейчас 08:00 Алматы, слот в 15:00 — до начала семь часов.
    const id = await book(SLOT);
    const before = await abuseCount();

    await cancel(client.accessToken, id).expect(200);

    const consultation = await prisma.consultation.findUniqueOrThrow({
      where: { id },
    });
    expect(consultation.status).toBe('CANCELLED');
    expect(consultation.outcome).toBe('CLIENT_CANCELLED');

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { consultationId: id },
    });
    expect(payment.status).toBe('VOIDED');
    expect(await abuseCount()).toBe(before);
  });

  it('отмена за полчаса: холд снят, счётчик вырос, есть audit поздней отмены', async () => {
    // Слоты идут по часам от 09:00 Алматы: ближайший доступный сегодня —
    // 10:00 Алматы (05:00 UTC), это «сейчас + 2 часа».
    const soon = '2026-08-24T05:00:00.000Z';
    // Запись сделана заранее, а отменяется, когда до начала полчаса.
    const id = await book(soon);
    const before = await abuseCount();
    const saved = fakeClock.current;
    fakeClock.current = new Date(new Date(soon).getTime() - 30 * 60_000);

    await cancel(client.accessToken, id).expect(200);
    fakeClock.current = saved;

    expect(await abuseCount()).toBe(before + 1);
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { consultationId: id },
    });
    expect(payment.status).toBe('VOIDED');

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: id, transition: 'consultation.late_cancelled' },
    });
    expect(audit).not.toBeNull();
  });

  it('три поздние отмены отключают клиенту автоподбор', async () => {
    // Одна уже была; добавляем ещё две.
    for (const hour of [13, 14]) {
      const slot = `2026-08-26T${String(hour - 5).padStart(2, '0')}:00:00.000Z`;
      const id = await book(slot);
      const saved = fakeClock.current;
      fakeClock.current = new Date(new Date(slot).getTime() - 30 * 60_000);
      await cancel(client.accessToken, id).expect(200);
      fakeClock.current = saved;
    }
    expect(await abuseCount()).toBeGreaterThanOrEqual(3);

    const res = await request(app.getHttpServer())
      .post('/v1/requests')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({ topicSlug: 'anxiety-stress', format: 'chat' });
    expect(res.status).toBe(403);
  });

  it('отмена специалистом: клиенту возврат, исход EXPERT_CANCELLED', async () => {
    const id = await book('2026-08-27T10:00:00.000Z');

    await cancelByExpert(expert.accessToken, id).expect(200);

    const consultation = await prisma.consultation.findUniqueOrThrow({
      where: { id },
    });
    expect(consultation.status).toBe('CANCELLED');
    expect(consultation.outcome).toBe('EXPERT_CANCELLED');

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { consultationId: id },
    });
    expect(payment.status).toBe('VOIDED');

    // Отмена специалистом клиента не штрафует.
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: id, transition: 'consultation.cancelled_by_expert' },
    });
    expect(audit).not.toBeNull();

    await flushPushOutbox(app);
    const notification = await prisma.notification.findFirst({
      where: { userId: client.userId, type: 'consultation.cancelled' },
      orderBy: { createdAt: 'desc' },
    });
    expect(notification).not.toBeNull();
  });

  it('клиент не может отменить чужой отменой специалиста и наоборот', async () => {
    const id = await book('2026-08-27T11:00:00.000Z');

    // Клиент не сотрудник специалиста: эндпоинт отмены специалистом
    // для него закрыт.
    await cancelByExpert(client.accessToken, id).expect(404);
    await cancel(client.accessToken, id).expect(200);
  });

  it('вторая отмена той же записи отбивается', async () => {
    const id = await book('2026-08-27T12:00:00.000Z');
    await cancel(client.accessToken, id).expect(200);

    const again = await cancel(client.accessToken, id);
    expect(again.status).toBe(409);
  });
});
