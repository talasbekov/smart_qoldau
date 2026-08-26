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
import { SettleRetryService } from '../src/payments/settle-retry.service';

// Денежный цикл плановой консультации (E6b, задача 7). Перехолд и capture
// писались в E5 до появления плановых записей, поэтому «должно работать»
// здесь недостаточно — это денежный путь.
const PH_E1 = '+77099500001';
const PH_C1 = '+77099500091';
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

describe('Деньги плановой консультации (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let expert: { accessToken: string; expertId: string };
  let client: { accessToken: string; userId: string };
  let cardId: string;
  let sweep: ScheduledSweepService;
  let settleRetry: SettleRetryService;

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
    settleRetry = app.get(SettleRetryService);
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

  it('холд плановой записи перехолдится, когда стареет больше пяти дней', async () => {
    // Запись на слот через семь дней: холд простоит дольше банковского
    // срока жизни, и его обязан обновить sweep E5.
    const far = '2026-08-31T10:00:00.000Z';
    const id = await book(far);
    const before = await prisma.payment.findUniqueOrThrow({
      where: { consultationId: id },
    });
    expect(before.status).toBe('HELD');

    fakeClock.current = new Date('2026-08-30T04:00:00Z'); // шесть суток спустя
    await settleRetry.sweep();

    const after = await prisma.payment.findUniqueOrThrow({
      where: { consultationId: id },
    });
    expect(after.status).toBe('HELD');
    expect(after.providerHoldId).not.toBe(before.providerHoldId);
    expect(after.holdCreatedAt!.getTime()).toBe(fakeClock.current.getTime());
    expect(after.reholdCount).toBe(1);

    // Повторный тик ничего не меняет: запись больше не попадает в выборку.
    await settleRetry.sweep();
    const again = await prisma.payment.findUniqueOrThrow({
      where: { consultationId: id },
    });
    expect(again.providerHoldId).toBe(after.providerHoldId);

    await prisma.consultation.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  });

  it('состоявшаяся плановая консультация проходит capture с комиссией 15%', async () => {
    fakeClock.current = new Date('2026-08-24T03:00:00Z');
    const id = await book(SLOT);

    fakeClock.current = new Date(SLOT);
    await sweep.tick();

    await request(app.getHttpServer())
      .post(`/v1/consultations/${id}/complete`)
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({ outcome: 'COMPLETED' })
      .expect(200);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { consultationId: id },
    });
    expect(payment.status).toBe('CAPTURED');
    expect(payment.commissionTiyn).toBe(Math.round(payment.amountTiyn * 0.15));

    const tx = await prisma.ledgerTransaction.findFirstOrThrow({
      where: { kind: 'capture', refId: payment.id },
      include: { entries: true },
    });
    // Двойная запись сходится в ноль.
    const debit = tx.entries.reduce((sum, e) => sum + e.debitTiyn, 0);
    const credit = tx.entries.reduce((sum, e) => sum + e.creditTiyn, 0);
    expect(debit).toBe(credit);
    const expertEntry = tx.entries.find((e) =>
      e.account.startsWith(`expert:${expert.expertId}`),
    );
    expect(expertEntry!.creditTiyn).toBe(
      payment.amountTiyn - payment.commissionTiyn,
    );
  });

  it('плановая с исходом CLIENT_NO_SHOW: холд снят, специалисту ничего', async () => {
    fakeClock.current = new Date('2026-08-24T03:00:00Z');
    const id = await book('2026-08-26T10:00:00.000Z');

    fakeClock.current = new Date('2026-08-26T10:00:00Z');
    await sweep.tick();

    await request(app.getHttpServer())
      .post(`/v1/consultations/${id}/complete`)
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .send({ outcome: 'CLIENT_NO_SHOW' })
      .expect(200);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { consultationId: id },
    });
    expect(payment.status).toBe('VOIDED');
    expect(
      await prisma.ledgerTransaction.count({
        where: { kind: 'capture', refId: payment.id },
      }),
    ).toBe(0);
  });

  it('ранняя отмена и отмена специалистом ledger не трогают', async () => {
    fakeClock.current = new Date('2026-08-24T03:00:00Z');
    const byClient = await book('2026-08-27T10:00:00.000Z');
    const byExpert = await book('2026-08-27T11:00:00.000Z');

    await request(app.getHttpServer())
      .post(`/v1/consultations/${byClient}/cancel`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/consultations/${byExpert}/cancel-by-expert`)
      .set('Authorization', `Bearer ${expert.accessToken}`)
      .expect(200);

    for (const id of [byClient, byExpert]) {
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { consultationId: id },
      });
      expect(payment.status).toBe('VOIDED');
      expect(
        await prisma.ledgerTransaction.count({ where: { refId: payment.id } }),
      ).toBe(0);
    }
  });
});
