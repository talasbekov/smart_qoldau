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
import { ScheduledSweepService } from '../src/consultations/scheduled-sweep.service';
import { flushPushOutbox } from './utils/outbox-helpers';

// Сквозной прогон эпика E6b (задача 10): расписание с выходным, запись,
// перенос, напоминание, активация и завершение с деньгами — одним
// сценарием, чтобы поймать взаимные конфликты частей.
const PH_E1 = '+77099600001';
const PH_C1 = '+77099600091';
const ALL_PHONES = [PH_E1, PH_C1];
const VISA_PAN = '4111111111111111';

const fakeClock = {
  current: new Date('2026-08-24T03:00:00Z'),
  now(): Date {
    return new Date(this.current);
  },
};

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    if (match) lastCode = match[1];
  }
}

describe('Плановая консультация: сквозной путь (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let expert: { accessToken: string; expertId: string };
  let client: { accessToken: string; userId: string };
  let cardId: string;
  let sweep: ScheduledSweepService;

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

  it('расписание, запись, перенос, напоминание, активация и деньги', async () => {
    const expertUserId = (
      await prisma.expert.findUniqueOrThrow({ where: { id: expert.expertId } })
    ).userId;

    // --- 1. Специалист ставит выходной на послезавтра ---
    await request(app.getHttpServer())
      .put('/v1/experts/me/schedule/exceptions/2026-08-26')
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({ isDayOff: true })
      .expect(200);

    const slotsOnDayOff = await request(app.getHttpServer())
      .get(
        `/v1/experts/${expert.expertId}/slots?from=2026-08-26T00:00:00.000Z&to=2026-08-26T23:59:59.000Z`,
      )
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);
    expect(slotsOnDayOff.body.items).toEqual([]);

    // --- 2. Клиент записывается на завтра 15:00 Алматы ---
    const slot = '2026-08-25T10:00:00.000Z';
    const consultationId = await book(slot);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { consultationId },
    });
    expect(payment.status).toBe('HELD');

    const afterBooking = await request(app.getHttpServer())
      .get(
        `/v1/experts/${expert.expertId}/slots?from=2026-08-25T00:00:00.000Z&to=2026-08-25T23:59:59.000Z`,
      )
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);
    const free = afterBooking.body.items.map(
      (i: { startAt: string }) => i.startAt,
    );
    expect(free).not.toContain(slot);

    // --- 3. Клиент переносит на 17:00 Алматы ---
    const newSlot = '2026-08-25T12:00:00.000Z';
    await request(app.getHttpServer())
      .post(`/v1/consultations/${consultationId}/reschedule`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({ slotStartAt: newSlot })
      .expect(200);

    const afterReschedule = await request(app.getHttpServer())
      .get(
        `/v1/experts/${expert.expertId}/slots?from=2026-08-25T00:00:00.000Z&to=2026-08-25T23:59:59.000Z`,
      )
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);
    const freeAfter = afterReschedule.body.items.map(
      (i: { startAt: string }) => i.startAt,
    );
    expect(freeAfter).toContain(slot);
    expect(freeAfter).not.toContain(newSlot);

    // Холд не пересоздан — сумма та же.
    const heldAfter = await prisma.payment.findUniqueOrThrow({
      where: { consultationId },
    });
    expect(heldAfter.providerHoldId).toBe(payment.providerHoldId);

    // --- 4. За 15 минут обе стороны получают напоминание ---
    fakeClock.current = new Date(new Date(newSlot).getTime() - 15 * 60_000);
    await sweep.tick();

    for (const userId of [client.userId, expertUserId]) {
      const reminders = await prisma.notification.findMany({
        where: { userId, type: 'consultation.reminder' },
      });
      expect(reminders).toHaveLength(1);
    }
    await flushPushOutbox(app);

    // --- 5. В момент слота консультация активируется, специалист занят ---
    fakeClock.current = new Date(newSlot);
    await sweep.tick();

    const activated = await prisma.consultation.findUniqueOrThrow({
      where: { id: consultationId },
    });
    expect(activated.status).toBe('ACTIVE');
    expect(activated.startedAt.toISOString()).toBe(newSlot);
    expect(
      (
        await prisma.expert.findUniqueOrThrow({
          where: { id: expert.expertId },
        })
      ).workStatus,
    ).toBe('BUSY');

    // --- 6. Специалист завершает: capture, 85% специалисту, ledger сходится ---
    await request(app.getHttpServer())
      .post(`/v1/consultations/${consultationId}/complete`)
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);

    const captured = await prisma.payment.findUniqueOrThrow({
      where: { consultationId },
    });
    expect(captured.status).toBe('CAPTURED');

    const tx = await prisma.ledgerTransaction.findFirstOrThrow({
      where: { kind: 'capture', refId: captured.id },
      include: { entries: true },
    });
    const debit = tx.entries.reduce((sum, e) => sum + e.debitTiyn, 0);
    const credit = tx.entries.reduce((sum, e) => sum + e.creditTiyn, 0);
    expect(debit).toBe(credit);
    const expertEntry = tx.entries.find((e) =>
      e.account.startsWith(`expert:${expert.expertId}`),
    );
    expect(expertEntry!.creditTiyn).toBe(
      captured.amountTiyn - captured.commissionTiyn,
    );

    // --- 7. Все переходы попали в audit ---
    const transitions = (
      await prisma.auditLog.findMany({
        where: { entityId: consultationId },
        select: { transition: true },
      })
    ).map((a) => a.transition);
    expect(transitions).toEqual(
      expect.arrayContaining([
        'consultation.booked',
        'consultation.rescheduled',
        'consultation.reminder_sent',
        'consultation.activated',
        'consultation.completed',
      ]),
    );
  });
});
