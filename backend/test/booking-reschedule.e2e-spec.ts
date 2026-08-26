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

// Перенос плановой консультации (E6b, задача 5). Холд при переносе не
// пересоздаётся: сумма та же, а перехолд по возрасту делает sweep E5.
const PH_E1 = '+77099200001';
const PH_C1 = '+77099200091';
const ALL_PHONES = [PH_E1, PH_C1];
const VISA_PAN = '4111111111111111';

const fakeClock = {
  current: new Date('2026-08-24T03:00:00Z'),
  now(): Date {
    return new Date(this.current);
  },
};

const SLOT = '2026-08-25T10:00:00.000Z';
const NEW_SLOT = '2026-08-25T12:00:00.000Z';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    if (match) lastCode = match[1];
  }
}

describe('Перенос плановой консультации (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let expert: { accessToken: string; expertId: string };
  let client: { accessToken: string; userId: string };
  let cardId: string;
  let consultationId: string;

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

  const reschedule = (token: string, id: string, slotStartAt: string) =>
    request(app.getHttpServer())
      .post(`/v1/consultations/${id}/reschedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ slotStartAt });

  const freeSlots = async (): Promise<string[]> => {
    const res = await request(app.getHttpServer())
      .get(
        `/v1/experts/${expert.expertId}/slots?from=2026-08-25T00:00:00.000Z&to=2026-08-25T23:59:59.000Z`,
      )
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);
    return res.body.items.map((i: { startAt: string }) => i.startAt);
  };

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

    const booking = await request(app.getHttpServer())
      .post('/v1/bookings')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({
        expertId: expert.expertId,
        topicSlug: 'anxiety-stress',
        format: 'chat',
        slotStartAt: SLOT,
        paymentMethodId: cardId,
      })
      .expect(201);
    consultationId = booking.body.consultationId;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('клиент переносит запись: время меняется, холд остаётся прежним', async () => {
    const before = await prisma.payment.findUniqueOrThrow({
      where: { consultationId },
    });

    const res = await reschedule(
      client.accessToken,
      consultationId,
      NEW_SLOT,
    ).expect(200);
    expect(res.body.startedAt).toBe(NEW_SLOT);

    const after = await prisma.payment.findUniqueOrThrow({
      where: { consultationId },
    });
    // Холд не пересоздаётся: сумма та же, а возраст лечит перехолд E5.
    expect(after.providerHoldId).toBe(before.providerHoldId);
    expect(after.status).toBe('HELD');

    const slots = await freeSlots();
    expect(slots).toContain(SLOT);
    expect(slots).not.toContain(NEW_SLOT);
  });

  it('вторая сторона получает уведомление о переносе', async () => {
    await flushPushOutbox(app);
    const expertUserId = (
      await prisma.expert.findUniqueOrThrow({ where: { id: expert.expertId } })
    ).userId;

    const notification = await prisma.notification.findFirst({
      where: { userId: expertUserId, type: 'consultation.rescheduled' },
      orderBy: { createdAt: 'desc' },
    });
    expect(notification).not.toBeNull();
  });

  it('специалист тоже может перенести, уведомление уходит клиенту', async () => {
    const res = await reschedule(
      expert.accessToken,
      consultationId,
      SLOT,
    ).expect(200);
    expect(res.body.startedAt).toBe(SLOT);

    await flushPushOutbox(app);
    const notification = await prisma.notification.findFirst({
      where: { userId: client.userId, type: 'consultation.rescheduled' },
      orderBy: { createdAt: 'desc' },
    });
    expect(notification).not.toBeNull();
  });

  it('перенос на занятый слот отклоняется', async () => {
    // Занимаем соседний слот другой записью того же клиента.
    const otherBooking = await request(app.getHttpServer())
      .post('/v1/bookings')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({
        expertId: expert.expertId,
        topicSlug: 'anxiety-stress',
        format: 'chat',
        slotStartAt: NEW_SLOT,
        paymentMethodId: cardId,
      })
      .expect(201);

    const res = await reschedule(client.accessToken, consultationId, NEW_SLOT);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_TAKEN');

    await prisma.consultation.update({
      where: { id: otherBooking.body.consultationId },
      data: { status: 'CANCELLED' },
    });
  });

  it('перенос не-SCHEDULED консультации отклоняется', async () => {
    await prisma.consultation.update({
      where: { id: consultationId },
      data: { status: 'ACTIVE' },
    });

    const res = await reschedule(client.accessToken, consultationId, NEW_SLOT);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONSULTATION_NOT_SCHEDULED');

    await prisma.consultation.update({
      where: { id: consultationId },
      data: { status: 'SCHEDULED' },
    });
  });

  it('посторонний перенести не может', async () => {
    const stranger = await request(app.getHttpServer())
      .post('/v1/auth/guest')
      .send({ deviceId: 'reschedule-e2e-stranger' })
      .expect(200);

    const res = await reschedule(
      stranger.body.accessToken,
      consultationId,
      NEW_SLOT,
    );
    expect(res.status).toBe(404);

    const strangerRows = await prisma.user.findMany({
      where: { deviceId: 'reschedule-e2e-stranger' },
      select: { id: true },
    });
    const strangerIds = strangerRows.map((u) => u.id);
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: strangerIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: strangerIds } } });
  });
});
