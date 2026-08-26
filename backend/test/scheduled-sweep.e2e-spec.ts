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
import { ScheduledSweepService } from '../src/consultations/scheduled-sweep.service';

// Sweep плановых консультаций (E6b, задача 6): напоминание за 15 минут
// обеим сторонам (Р-15) и перевод SCHEDULED → ACTIVE в момент слота.
const PH_E1 = '+77099400001';
const PH_C1 = '+77099400091';
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

describe('Активация и напоминание плановой консультации (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let expert: { accessToken: string; expertId: string };
  let client: { accessToken: string; userId: string };
  let cardId: string;
  let sweep: ScheduledSweepService;
  let expertUserId: string;

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

  const notificationsOf = async (
    userId: string,
    type: string,
  ): Promise<{ title: string; body: string }[]> =>
    prisma.notification.findMany({
      where: { userId, type },
      select: { title: true, body: true },
    });

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
    sweep = app.get(ScheduledSweepService);
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

    expertUserId = (
      await prisma.expert.findUniqueOrThrow({ where: { id: expert.expertId } })
    ).userId;
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

  it('за 15 минут до начала обе стороны получают напоминание без ПД', async () => {
    await book(SLOT);

    // За полчаса — рано.
    fakeClock.current = new Date(new Date(SLOT).getTime() - 30 * 60_000);
    await sweep.tick();
    expect(
      await notificationsOf(client.userId, 'consultation.reminder'),
    ).toEqual([]);

    // За 10 минут — пора.
    fakeClock.current = new Date(new Date(SLOT).getTime() - 10 * 60_000);
    await sweep.tick();

    const forClient = await notificationsOf(
      client.userId,
      'consultation.reminder',
    );
    const forExpert = await notificationsOf(
      expertUserId,
      'consultation.reminder',
    );
    expect(forClient).toHaveLength(1);
    expect(forExpert).toHaveLength(1);

    // Ни темы, ни имени, ни цены — PII-правило пушей E9.
    const text = JSON.stringify([...forClient, ...forExpert]);
    expect(text).not.toContain('Тревога');
    expect(text).not.toContain('3 990');
    expect(text).not.toContain('Айгуль');

    // Повторный тик второго напоминания не шлёт.
    await sweep.tick();
    expect(
      await notificationsOf(client.userId, 'consultation.reminder'),
    ).toHaveLength(1);

    // Пуши уходят через очередь, а не из тика.
    await flushPushOutbox(app);
  });

  it('в момент слота консультация становится ACTIVE, специалист BUSY', async () => {
    const consultation = await prisma.consultation.findFirstOrThrow({
      where: { clientUserId: client.userId, startedAt: new Date(SLOT) },
    });

    fakeClock.current = new Date(SLOT);
    await sweep.tick();

    const activated = await prisma.consultation.findUniqueOrThrow({
      where: { id: consultation.id },
    });
    expect(activated.status).toBe('ACTIVE');

    const expertRow = await prisma.expert.findUniqueOrThrow({
      where: { id: expert.expertId },
    });
    expect(expertRow.workStatus).toBe('BUSY');

    const audit = await prisma.auditLog.findFirst({
      where: {
        entityId: consultation.id,
        transition: 'consultation.activated',
      },
    });
    expect(audit).not.toBeNull();
  });

  it('просроченная запись активируется без запоздалого напоминания', async () => {
    // Инстанс «лежал»: слот наступил, пока sweep не работал.
    fakeClock.current = new Date('2026-08-24T03:00:00Z');
    const late = await book('2026-08-26T10:00:00.000Z');
    fakeClock.current = new Date('2026-08-26T10:05:00.000Z');

    await sweep.tick();

    const row = await prisma.consultation.findUniqueOrThrow({
      where: { id: late },
    });
    expect(row.status).toBe('ACTIVE');
    // Напоминание «через 15 минут» о начавшемся дезориентирует.
    expect(row.remindedAt).toBeNull();
  });

  it('отменённая запись не активируется', async () => {
    fakeClock.current = new Date('2026-08-24T03:00:00Z');
    const id = await book('2026-08-27T10:00:00.000Z');
    await prisma.consultation.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    fakeClock.current = new Date('2026-08-27T10:01:00.000Z');
    await sweep.tick();

    const row = await prisma.consultation.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('CANCELLED');
  });
});
