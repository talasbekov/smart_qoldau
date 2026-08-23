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

// Запись на слот (E6b, задача 4). Опубликованное расписание и есть
// согласие специалиста, поэтому цепочки офферов и таймера Р-10 здесь нет.
const PH_E1 = '+77099100001';
const PH_C1 = '+77099100091';
const PH_C2 = '+77099100092';
const ALL_PHONES = [PH_E1, PH_C1, PH_C2];
const VISA_PAN = '4111111111111111';
const DECLINE_PAN = '4000000000000002';

// Понедельник 2026-08-24, 03:00 UTC = 08:00 Алматы.
const fakeClock = {
  current: new Date('2026-08-24T03:00:00Z'),
  now(): Date {
    return new Date(this.current);
  },
};

// 2026-08-25 (вторник), 15:00 Алматы = 10:00 UTC.
const SLOT = '2026-08-25T10:00:00.000Z';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    if (match) lastCode = match[1];
  }
}

describe('Запись на слот (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let expert: { accessToken: string; expertId: string };
  let client: { accessToken: string; userId: string };
  let other: { accessToken: string; userId: string };
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
    await prisma.scheduleException.deleteMany({
      where: { expertId: { in: expertIds } },
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

  const book = (token: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/v1/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const defaultBooking = (slotStartAt = SLOT) => ({
    expertId: expert.expertId,
    topicSlug: 'anxiety-stress',
    format: 'chat',
    slotStartAt,
    paymentMethodId: cardId,
  });

  async function addCard(token: string, pan: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/v1/payment-methods')
      .set('Authorization', `Bearer ${token}`)
      .send({ pan, expiry: '12/28', holderName: 'Ivan Petrov' })
      .expect(201);
    return res.body.id as string;
  }

  const freeSlots = async (token: string): Promise<string[]> => {
    const res = await request(app.getHttpServer())
      .get(
        `/v1/experts/${expert.expertId}/slots?from=2026-08-25T00:00:00.000Z&to=2026-08-25T23:59:59.000Z`,
      )
      .set('Authorization', `Bearer ${token}`)
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

    // Только чат и аудио: запись на видео должна отбиваться.
    expert = await registeredExpertUser(app, PH_E1, () => lastCode, {
      formats: ['chat', 'audio'],
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
    other = await clientUserHelper(app, PH_C2, () => lastCode);
    cardId = await addCard(client.accessToken, VISA_PAN);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('запись создаёт SCHEDULED-консультацию с холдом и снимает слот из выдачи', async () => {
    expect(await freeSlots(client.accessToken)).toContain(SLOT);

    const res = await book(client.accessToken, defaultBooking()).expect(201);
    expect(res.body).toMatchObject({
      status: 'SCHEDULED',
      startedAt: SLOT,
      paymentStatus: 'HELD',
    });

    const consultation = await prisma.consultation.findUniqueOrThrow({
      where: { id: res.body.consultationId },
    });
    expect(consultation.status).toBe('SCHEDULED');
    expect(consultation.startedAt.toISOString()).toBe(SLOT);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { consultationId: consultation.id },
    });
    expect(payment.status).toBe('HELD');

    expect(await freeSlots(client.accessToken)).not.toContain(SLOT);
  });

  it('специалист получает уведомление без темы обращения', async () => {
    await flushPushOutbox(app);
    const expertUserId = (
      await prisma.expert.findUniqueOrThrow({ where: { id: expert.expertId } })
    ).userId;

    const notification = await prisma.notification.findFirstOrThrow({
      where: { userId: expertUserId, type: 'consultation.booked' },
      orderBy: { createdAt: 'desc' },
    });
    // PII-правило E9: тема обращения в уведомление не попадает.
    expect(`${notification.title} ${notification.body}`).not.toContain(
      'Тревога',
    );
    expect(JSON.stringify(notification.data)).not.toContain('anxiety-stress');
  });

  it('повторный идентичный запрос не создаёт второй записи и второго холда', async () => {
    const before = await prisma.payment.count({
      where: { clientUserId: client.userId },
    });

    const res = await book(client.accessToken, defaultBooking());
    expect(res.status).toBe(200);

    const after = await prisma.payment.count({
      where: { clientUserId: client.userId },
    });
    expect(after).toBe(before);
    expect(
      await prisma.consultation.count({
        where: { clientUserId: client.userId, status: 'SCHEDULED' },
      }),
    ).toBe(1);
  });

  it('чужая запись на занятый слот → 409 SLOT_TAKEN', async () => {
    const otherCard = await addCard(other.accessToken, VISA_PAN);
    const res = await book(other.accessToken, {
      ...defaultBooking(),
      paymentMethodId: otherCard,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_TAKEN');
  });

  it('запись поверх незакоммиченной чужой брони отбивается базой', async () => {
    const slot = '2026-08-25T11:00:00.000Z';
    const otherCard = (
      await prisma.paymentMethod.findFirstOrThrow({
        where: { userId: other.userId, deletedAt: null },
      })
    ).id;
    const topic = await prisma.topic.findFirstOrThrow({
      where: { slug: 'anxiety-stress' },
    });

    // Детерминированная гонка: конкурент уже вставил запись на слот, но
    // его транзакция ещё не закоммичена. Проверка «слот свободен» её не
    // видит, поэтому единственная защита — уникальный индекс в базе.
    let rivalConsultationId = '';
    const rival = prisma.$transaction(async (tx) => {
      const request = await tx.request.create({
        data: {
          clientUserId: client.userId,
          clientCode: 4242,
          topicId: topic.id,
          format: 'chat',
          status: 'MATCHED',
          matchedExpertId: expert.expertId,
        },
      });
      const created = await tx.consultation.create({
        data: {
          requestId: request.id,
          clientUserId: client.userId,
          clientCode: 4242,
          expertId: expert.expertId,
          topicId: topic.id,
          format: 'chat',
          priceTiyn: 399000,
          status: 'SCHEDULED',
          startedAt: new Date(slot),
        },
      });
      rivalConsultationId = created.id;
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    await new Promise((resolve) => setTimeout(resolve, 80));
    const attempt = book(other.accessToken, {
      ...defaultBooking(slot),
      paymentMethodId: otherCard,
    });

    const [, res] = await Promise.all([rival, attempt]);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_TAKEN');

    const onSlot = await prisma.consultation.findMany({
      where: {
        expertId: expert.expertId,
        startedAt: new Date(slot),
        status: { in: ['SCHEDULED', 'ACTIVE'] },
      },
    });
    expect(onSlot).toHaveLength(1);
    expect(onSlot[0].id).toBe(rivalConsultationId);
  });

  it('отказ банка не оставляет висящей SCHEDULED-записи', async () => {
    const badCard = await addCard(other.accessToken, DECLINE_PAN);
    const slot = '2026-08-25T12:00:00.000Z';

    const res = await book(other.accessToken, {
      ...defaultBooking(slot),
      paymentMethodId: badCard,
    });
    expect(res.status).toBe(402);
    expect(res.body.error.code).toBe('PROVIDER_DECLINED');

    const stuck = await prisma.consultation.findFirst({
      where: {
        expertId: expert.expertId,
        startedAt: new Date(slot),
        status: 'SCHEDULED',
      },
    });
    expect(stuck).toBeNull();
    // Слот снова свободен.
    expect(await freeSlots(client.accessToken)).toContain(slot);
  });

  it('слот в прошлом и слишком близкий отклоняются', async () => {
    const past = await book(client.accessToken, {
      ...defaultBooking('2026-08-20T10:00:00.000Z'),
    });
    expect(past.status).toBe(400);
    expect(past.body.error.code).toBe('SLOT_OUT_OF_RANGE');

    const tooFar = await book(client.accessToken, {
      ...defaultBooking('2026-10-01T10:00:00.000Z'),
    });
    expect(tooFar.status).toBe(400);
    expect(tooFar.body.error.code).toBe('SLOT_OUT_OF_RANGE');
  });

  it('слот вне расписания → 409 SLOT_UNAVAILABLE', async () => {
    // 04:00 Алматы — специалист не работает.
    const res = await book(client.accessToken, {
      ...defaultBooking('2026-08-26T23:00:00.000Z'),
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLOT_UNAVAILABLE');
  });

  it('формат, которого у специалиста нет, отклоняется', async () => {
    const res = await book(client.accessToken, {
      ...defaultBooking('2026-08-26T10:00:00.000Z'),
      format: 'video',
    });
    // Специалист не работает в видеоформате — запись бессмысленна.
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EXPERT_TOPIC_MISMATCH');
  });
});
