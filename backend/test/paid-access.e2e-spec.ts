import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConsultationPaymentStatus, PaymentStatus } from '@prisma/client';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ChatService } from '../src/chat/chat.service';
import { PaymentsService } from '../src/payments/payments.service';
import { RedisService } from '../src/redis/redis.service';
import { WebhookSignature } from '../src/payments/provider/webhook-signature';
import { createApp } from './utils/create-app';

// Real HTTP/WS, database and existing mock acquiring port. Fixtures are scoped
// to this suite; no global database/Redis cleanup.
describe('E5 paid live access', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let id: string;
  let expertId: string;
  let topicId: string;
  let cardId: string;
  let wsUrl: string;
  const users: string[] = [];
  const tokens: string[] = [];
  const sockets: Socket[] = [];
  const post = (who: number, path: string) =>
    request(app.getHttpServer())
      .post(path)
      .auth(tokens[who], { type: 'bearer' });
  const get = (who: number, path: string) =>
    request(app.getHttpServer())
      .get(path)
      .auth(tokens[who], { type: 'bearer' });
  const path = (suffix = '') => `/v1/consultations/${id}${suffix}`;

  function event(socket: Socket, name: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const listener = (value: unknown) => {
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => {
        socket.off(name, listener);
        reject(new Error(`Timed out waiting for ${name}`));
      }, 2000);
      socket.once(name, listener);
    });
  }
  async function ready(who: number) {
    const socket = io(wsUrl, {
      auth: { token: tokens[who] },
      transports: ['websocket'],
      reconnection: false,
      autoConnect: false,
    });
    sockets.push(socket);
    const pending = event(socket, 'ready');
    socket.connect();
    await pending;
    return socket;
  }
  async function hold() {
    await post(0, path('/pay')).send({ paymentMethodId: cardId }).expect(200);
    return prisma.payment.findUniqueOrThrow({ where: { consultationId: id } });
  }
  async function setPayment(state: string) {
    if (state === 'UNPAID') return;
    if (state === 'missing') {
      await prisma.consultation.update({
        where: { id },
        data: { paymentStatus: 'HELD' },
      });
      return;
    }
    const payment = await hold();
    if (state === 'no-hold-date') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { holdCreatedAt: null },
      });
      return;
    }
    if (state === 'stale-mirror') {
      await prisma.consultation.update({
        where: { id },
        data: { paymentStatus: 'FAILED' },
      });
      return;
    }
    if (state === 'no-hold-id') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { providerHoldId: null },
      });
      return;
    }
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: state as PaymentStatus },
    });
    // Stale HELD mirror must never override an unconfirmed/revoked Payment.
  }

  beforeAll(async () => {
    app = await createApp(Test.createTestingModule({ imports: [AppModule] }));
    prisma = app.get(PrismaService);
    for (let i = 0; i < 3; i++) {
      const user = await prisma.user.create({ data: {} });
      users.push(user.id);
      tokens.push((await app.get(AuthService).issueTokens(user)).accessToken);
    }
    expertId = (
      await prisma.expert.create({
        data: {
          userId: users[1],
          displayName: 'E5',
          city: 'Алматы',
          experience: 'FIVE_TO_TEN',
          education: 'Test',
          priceTiyn: 400000,
          languages: ['ru'],
          formats: ['chat', 'audio'],
          verificationStatus: 'VERIFIED',
        },
      })
    ).id;
    topicId = (
      await prisma.topic.create({
        data: {
          slug: `e5-${randomUUID()}`,
          nameRu: 'E5',
          nameKz: 'E5',
          sortOrder: 999,
        },
      })
    ).id;
    cardId = (
      await post(0, '/v1/payment-methods')
        .send({
          pan: '4111111111111111',
          expiry: '12/28',
          holderName: 'Test User',
        })
        .expect(201)
    ).body.id;
    await app.listen(0, '127.0.0.1');
    wsUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/ws`;
  });
  beforeEach(async () => {
    id = (
      await prisma.consultation.create({
        data: {
          requestId: randomUUID(),
          clientUserId: users[0],
          clientCode: 1234,
          expertId,
          topicId,
          format: 'chat',
          priceTiyn: 400000,
          startedAt: new Date(),
        },
      })
    ).id;
  });
  afterEach(async () => {
    sockets.splice(0).forEach((socket) => socket.disconnect());
    await prisma.consultation.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  });
  afterAll(async () => {
    if (!app) return;
    const consultations = await prisma.consultation.findMany({
      where: { expertId },
      select: { id: true },
    });
    const ids = consultations.map((c) => c.id);
    const payments = await prisma.payment.findMany({
      where: { consultationId: { in: ids } },
    });
    await prisma.ledgerEntry.deleteMany({
      where: { transaction: { refId: { in: payments.map((p) => p.id) } } },
    });
    await prisma.ledgerTransaction.deleteMany({
      where: { refId: { in: payments.map((p) => p.id) } },
    });
    await prisma.payment.deleteMany({ where: { consultationId: { in: ids } } });
    await prisma.chatMessage.deleteMany({
      where: { consultationId: { in: ids } },
    });
    await prisma.consultation.deleteMany({ where: { id: { in: ids } } });
    await prisma.paymentMethod.deleteMany({ where: { userId: { in: users } } });
    await prisma.expert.delete({ where: { id: expertId } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.topic.delete({ where: { id: topicId } });
    await app.close();
  });

  const deniedStates = [
    'UNPAID',
    'PENDING',
    'FAILED',
    'VOIDED',
    'CAPTURED',
    'missing',
    'no-hold-id',
    'no-hold-date',
    'stale-mirror',
  ];
  it.each(deniedStates)(
    '%s denies messages, typing and media before side effects',
    async (state) => {
      await setPayment(state);
      const sender = await ready(0);
      const receiver = await ready(1);
      const received: unknown[] = [];
      receiver.on('chat.typing', (value) => received.push(value));
      sender.on('chat.typing', (value) => received.push(value));
      receiver.on('chat.message', (value) => received.push(value));
      const error = event(sender, 'chat.error');
      sender.emit('chat.send', {
        consultationId: id,
        text: 'Must not persist',
      });
      sender.emit('chat.typing', { consultationId: id });
      receiver.emit('chat.typing', { consultationId: id });
      expect(await error).toEqual({ code: 'PAYMENT_HOLD_REQUIRED' });
      for (const who of [0, 1]) {
        const response = await post(who, path('/media-token'))
          .send({ format: 'audio' })
          .expect(402);
        expect(response.body.error.code).toBe('PAYMENT_HOLD_REQUIRED');
        await expect(
          app.get(ChatService).send(id, users[who], 'denied'),
        ).rejects.toMatchObject({ status: 402 });
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(received).toEqual([]);
      expect(
        await prisma.chatMessage.count({ where: { consultationId: id } }),
      ).toBe(0);
      expect(
        (await prisma.consultation.findUniqueOrThrow({ where: { id } })).format,
      ).toBe('chat');
      expect((await get(0, path()).expect(200)).body.id).toBe(id);
    },
  );

  it.each(deniedStates)(
    '%s cannot become a successfully completed consultation',
    async (state) => {
      await setPayment(state);
      const response = await post(1, path('/complete'))
        .send({ outcome: 'COMPLETED' })
        .expect(402);
      expect(response.body.error.code).toBe('PAYMENT_HOLD_REQUIRED');
      expect(
        await prisma.consultation.findUniqueOrThrow({ where: { id } }),
      ).toMatchObject({ status: 'ACTIVE', outcome: null });
      expect(
        await prisma.ledgerTransaction.count({
          where: {
            refId:
              (
                await prisma.payment.findUnique({
                  where: { consultationId: id },
                })
              )?.id ?? id,
          },
        }),
      ).toBe(0);
    },
  );

  it('HELD allows both participants; strangers remain 404; completion captures exactly once and preserves history', async () => {
    const payment = await hold();
    await post(0, path('/pay')).send({ paymentMethodId: cardId }).expect(409);
    for (const who of [0, 1]) {
      await post(who, path('/media-token'))
        .send({ format: 'audio' })
        .expect(201);
    }
    await post(2, path('/media-token')).send({ format: 'audio' }).expect(404);
    await expect(
      app.get(ChatService).send(id, users[2], 'stranger'),
    ).rejects.toMatchObject({ status: 404 });
    const client = await ready(0);
    const expert = await ready(1);
    const message = event(expert, 'chat.message');
    client.emit('chat.send', { consultationId: id, text: 'Paid message' });
    expect((await message).text).toBe('Paid message');
    const typing = event(client, 'chat.typing');
    expert.emit('chat.typing', { consultationId: id });
    expect(await typing).toEqual({ consultationId: id, senderRole: 'expert' });
    await post(1, path('/complete')).send({ outcome: 'COMPLETED' }).expect(200);
    await post(1, path('/complete')).send({ outcome: 'COMPLETED' }).expect(409);
    await app.get(PaymentsService).settle(id);
    expect(
      (
        await prisma.payment.findUniqueOrThrow({
          where: { consultationId: id },
        })
      ).status,
    ).toBe('CAPTURED');
    const ledger = await prisma.ledgerTransaction.findMany({
      where: { kind: 'capture', refId: payment.id },
      include: { entries: true },
    });
    expect(ledger).toHaveLength(1);
    expect(
      ledger[0].entries.map((e) => e.creditTiyn).sort((a, b) => a - b),
    ).toEqual([0, 60000, 340000]);
    const provider = await app
      .get(RedisService)
      .get(`mockpay:hold:${payment.providerHoldId}`);
    expect(JSON.parse(provider!).status).toBe('captured');
    for (const who of [0, 1]) {
      expect(
        (await get(who, path('/messages')).expect(200)).body.items[0].text,
      ).toBe('Paid message');
      await post(who, path('/media-token'))
        .send({ format: 'audio' })
        .expect(409);
    }
    await get(2, path('/messages')).expect(404);
  });

  it('bank void webhook revokes access, duplicate delivery is harmless, retry hold restores access', async () => {
    const payment = await hold();
    const body = JSON.stringify({
      eventId: randomUUID(),
      type: 'hold.voided_by_bank',
      providerHoldId: payment.providerHoldId,
    });
    const signature = WebhookSignature.sign(
      process.env.PAYMENT_WEBHOOK_SECRET!,
      Buffer.from(body),
    );
    for (let i = 0; i < 2; i++) {
      await request(app.getHttpServer())
        .post('/v1/webhooks/payments')
        .set('Content-Type', 'application/json')
        .set('x-payment-signature', signature)
        .send(body)
        .expect(200);
    }
    await post(0, path('/media-token')).send({ format: 'audio' }).expect(402);
    await expect(
      app.get(ChatService).send(id, users[0], 'revoked'),
    ).rejects.toMatchObject({ status: 402 });
    await post(1, path('/complete')).send({ outcome: 'COMPLETED' }).expect(402);
    const retried = await hold();
    expect(retried.holdAttempts).toBe(2);
    expect(retried.providerHoldId).not.toBe(payment.providerHoldId);
    await post(0, path('/media-token')).send({ format: 'audio' }).expect(201);
  });

  it.each(['CLIENT_NO_SHOW', 'TECH_ISSUE', 'CLIENT_CANCELLED'] as const)(
    '%s releases the full hold without capture',
    async (outcome) => {
      const payment = await hold();
      if (outcome === 'CLIENT_CANCELLED')
        await post(0, path('/cancel')).expect(200);
      else await post(1, path('/complete')).send({ outcome }).expect(200);
      await app.get(PaymentsService).settle(id);
      expect(
        (
          await prisma.payment.findUniqueOrThrow({
            where: { consultationId: id },
          })
        ).status,
      ).toBe('VOIDED');
      expect(
        await prisma.ledgerTransaction.count({ where: { refId: payment.id } }),
      ).toBe(0);
    },
  );

  it('legacy COMPLETED + PENDING fails settlement and keeps its diagnostic audit', async () => {
    await setPayment('PENDING');
    await prisma.consultation.update({
      where: { id },
      data: { status: 'COMPLETED', outcome: 'COMPLETED' },
    });
    await expect(app.get(PaymentsService).settle(id)).rejects.toMatchObject({
      status: 402,
    });
    const payment = await prisma.payment.findUniqueOrThrow({
      where: { consultationId: id },
    });
    expect(
      await prisma.auditLog.count({
        where: {
          entityId: payment.id,
          transition: 'payment.stuck_pending_on_settle',
        },
      }),
    ).toBe(1);
  });

  it('typing is silent for strangers and completed consultations, including unpaid history', async () => {
    await hold();
    const client = await ready(0);
    const expert = await ready(1);
    const stranger = await ready(2);
    const received: unknown[] = [];
    for (const socket of [client, expert])
      socket.on('chat.typing', (value) => received.push(value));
    const error = event(stranger, 'chat.error');
    stranger.emit('chat.send', { consultationId: id, text: 'stranger' });
    stranger.emit('chat.typing', { consultationId: id });
    expect(await error).toEqual({ code: 'CONSULTATION_NOT_FOUND' });
    await app.get(ChatService).send(id, users[0], 'Historical message');
    await prisma.consultation.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        outcome: 'COMPLETED',
        paymentStatus: 'UNPAID',
      },
    });
    await prisma.payment.delete({ where: { consultationId: id } });
    client.emit('chat.typing', { consultationId: id });
    expert.emit('chat.typing', { consultationId: id });
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(received).toEqual([]);
    for (const who of [0, 1]) {
      expect(
        (await get(who, path('/messages')).expect(200)).body.items[0].text,
      ).toBe('Historical message');
    }
  });

  it('unpaid cancellation stays available; legacy missing payment on COMPLETED is an explicit settle failure', async () => {
    await post(0, path('/cancel')).expect(200);
    await prisma.consultation.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        outcome: 'COMPLETED',
        paymentStatus: ConsultationPaymentStatus.UNPAID,
      },
    });
    await expect(app.get(PaymentsService).settle(id)).rejects.toMatchObject({
      status: 402,
    });
    expect(
      (await prisma.consultation.findUniqueOrThrow({ where: { id } }))
        .paymentStatus,
    ).toBe('UNPAID');
  });
});
