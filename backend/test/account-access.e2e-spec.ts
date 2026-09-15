import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from './utils/create-app';
import Redis from 'ioredis';
import { RedisService } from '../src/redis/redis.service';
import { RedisIoAdapter } from '../src/ws/redis-io.adapter';
import { EventsService } from '../src/ws/events.service';
import { EventsGateway } from '../src/ws/events.gateway';
import { AccountAccessService } from '../src/auth/account-access.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { AdminAuth, adminUser } from './utils/admin-helpers';

// Real signed access tokens, HTTP guards, admin block path and Socket.IO events.
// Removing the current-state check must allow the old token to act again.
describe('E29 current account access (HTTP + WS)', () => {
  let app: INestApplication;
  let remoteApp: INestApplication;
  let remoteWsUrl: string;
  const adapterClients: Redis[] = [];
  let prisma: PrismaService;
  let admin: AdminAuth;
  let wsUrl: string;
  let expertId: string;
  let consultationId: string;
  let topicId: string;
  const users: string[] = [];
  const tokens: string[] = [];
  const sockets: Socket[] = [];

  const get = (token: string, path: string) =>
    request(app.getHttpServer()).get(path).auth(token, { type: 'bearer' });
  const post = (token: string, path: string) =>
    request(app.getHttpServer()).post(path).auth(token, { type: 'bearer' });
  const messagesPath = () => `/v1/consultations/${consultationId}/messages`;

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

  function outcome(entries: [Socket, string][]): Promise<string> {
    return new Promise((resolve, reject) => {
      const listeners = entries.map(([socket, name]) => {
        const listener = () => {
          cleanup();
          resolve(name);
        };
        socket.once(name, listener);
        return { socket, name, listener };
      });
      const cleanup = () => {
        clearTimeout(timer);
        listeners.forEach(({ socket, name, listener }) =>
          socket.off(name, listener),
        );
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('No WS outcome'));
      }, 2000);
    });
  }

  function connect(token: string, url = wsUrl) {
    const socket = io(url, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      autoConnect: false,
    });
    sockets.push(socket);
    return socket;
  }

  async function ready(token: string, url = wsUrl) {
    const socket = connect(token, url);
    const pending = event(socket, 'ready');
    socket.connect();
    await pending;
    return socket;
  }

  async function blockExpert() {
    await post(admin.token, `/v1/admin/experts/${expertId}/block`)
      .send({ reason: 'E29 access regression' })
      .expect(200);
  }

  async function denyAccount(kind: 'expert' | 'client') {
    if (kind === 'expert') await blockExpert();
    else {
      // Client account deactivation uses deletedAt; there is no User.isBlocked.
      await prisma.user.update({
        where: { id: users[0] },
        data: { deletedAt: new Date() },
      });
    }
  }

  async function createRedisApp() {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const instance = module.createNestApplication({ rawBody: true });
    configureApp(instance);
    const redis = instance.get(RedisService);
    const duplicate = redis.duplicate.bind(redis);
    const spy = jest.spyOn(redis, 'duplicate').mockImplementation((...args) => {
      const client = duplicate(...args);
      adapterClients.push(client);
      return client;
    });
    const adapter = new RedisIoAdapter(instance, redis);
    await adapter.connectToRedis();
    spy.mockRestore();
    instance.useWebSocketAdapter(adapter);
    try {
      await instance.init();
      return instance;
    } catch (error) {
      await instance.close();
      throw error;
    }
  }

  beforeAll(async () => {
    app = await createRedisApp();
    remoteApp = await createRedisApp();
    prisma = app.get(PrismaService);
    for (let i = 0; i < 3; i++) {
      const user = await prisma.user.create({ data: {} });
      users.push(user.id);
      tokens.push((await app.get(AuthService).issueTokens(user)).accessToken);
    }
    const expert = await prisma.expert.create({
      data: {
        userId: users[1],
        displayName: 'E29',
        city: 'Алматы',
        experience: 'FIVE_TO_TEN',
        education: 'Test',
        priceTiyn: 399000,
        languages: ['ru'],
        formats: ['chat'],
        verificationStatus: 'VERIFIED',
      },
    });
    expertId = expert.id;
    const topic = await prisma.topic.create({
      data: {
        slug: `e29-${randomUUID()}`,
        nameRu: 'E29',
        nameKz: 'E29',
        sortOrder: 999,
      },
    });
    topicId = topic.id;
    const consultation = await prisma.consultation.create({
      data: {
        requestId: randomUUID(),
        clientUserId: users[0],
        clientCode: 1234,
        expertId,
        topicId,
        format: 'chat',
        priceTiyn: 399000,
        startedAt: new Date(),
      },
    });
    consultationId = consultation.id;
    admin = await adminUser(app, ['VERIFICATION_OPERATOR']);
    await app.listen(0, '127.0.0.1');
    wsUrl = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/ws`;
    await remoteApp.listen(0, '127.0.0.1');
    remoteWsUrl = `http://127.0.0.1:${(remoteApp.getHttpServer().address() as AddressInfo).port}/ws`;
  });

  beforeEach(async () => {
    await prisma.user.updateMany({
      where: { id: { in: users } },
      data: { deletedAt: null },
    });
    await prisma.expert.update({
      where: { id: expertId },
      data: { isBlocked: false, verificationStatus: 'VERIFIED' },
    });
    await prisma.chatMessage.deleteMany({ where: { consultationId } });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    sockets.splice(0).forEach((socket) => socket.disconnect());
  });

  afterAll(async () => {
    if (prisma && consultationId) {
      await prisma.chatMessage.deleteMany({ where: { consultationId } });
      await prisma.consultation.delete({ where: { id: consultationId } });
      await prisma.topic.delete({ where: { id: topicId } });
      await prisma.notificationOutbox.deleteMany({
        where: { userId: { in: users } },
      });
      await prisma.notification.deleteMany({
        where: { userId: { in: users } },
      });
      await prisma.expert.delete({ where: { id: expertId } });
      await prisma.refreshToken.deleteMany({
        where: { userId: { in: users } },
      });
      await prisma.auditLog.deleteMany({
        where: {
          entityId: { in: [...users, expertId, consultationId, admin.id] },
        },
      });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
      await prisma.adminUser.delete({ where: { id: admin.id } });
    }
    await remoteApp?.close();
    await app?.close();
    adapterClients.forEach((client) => client.disconnect());
  });

  it('active client and expert can read HTTP and send through WS', async () => {
    const peer = await ready(tokens[0]);
    const expert = await ready(tokens[1]);
    for (const [socket, token] of [
      [peer, tokens[0]],
      [expert, tokens[1]],
    ] as const) {
      await get(token, messagesPath()).expect(200);
      const received = event(peer, 'chat.message');
      socket.emit('chat.send', { consultationId, text: 'allowed' });
      expect((await received).text).toBe('allowed');
    }
    expect(await prisma.chatMessage.count({ where: { consultationId } })).toBe(
      2,
    );
  });

  it.each(['expert', 'client'] as const)(
    '%s old JWT loses HTTP read/write access after current state changes',
    async (kind) => {
      const token = tokens[kind === 'expert' ? 1 : 0];
      await get(token, messagesPath()).expect(200);
      await denyAccount(kind);
      await get(token, messagesPath()).expect(kind === 'expert' ? 403 : 401);
      await post(token, '/v1/me/expert-visibility')
        .send({ displayName: 'denied' })
        .expect(kind === 'expert' ? 403 : 401);
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: users[kind === 'expert' ? 1 : 0] },
      });
      expect(user.expertVisibilityAcceptedAt).toBeNull();
    },
  );

  it.each(['expert', 'client'] as const)(
    '%s cannot connect WS with an old JWT after denial',
    async (kind) => {
      await denyAccount(kind);
      const socket = connect(tokens[kind === 'expert' ? 1 : 0]);
      const result = outcome([
        [socket, 'disconnect'],
        [socket, 'ready'],
      ]);
      socket.connect();
      expect(await result).toBe('disconnect');
    },
  );

  it.each([
    ['expert', 'chat.send'],
    ['expert', 'chat.typing'],
    ['client', 'chat.send'],
    ['client', 'chat.typing'],
  ] as const)(
    '%s already-open WS denies the next %s after state changes',
    async (kind, action) => {
      const index = kind === 'expert' ? 1 : 0;
      const peer = await ready(tokens[1 - index]);
      const socket = await ready(tokens[index]);
      const received: unknown[] = [];
      peer.on('chat.message', (payload) => received.push(payload));
      peer.on('chat.typing', (payload) => received.push(payload));
      await denyAccount(kind);
      const result = outcome([
        [socket, 'disconnect'],
        [peer, 'chat.message'],
        [peer, 'chat.typing'],
      ]);
      socket.emit(action, { consultationId, text: 'must not persist' });
      expect(await result).toBe('disconnect');
      expect(received).toEqual([]);
      expect(
        await prisma.chatMessage.count({ where: { consultationId } }),
      ).toBe(0);
    },
  );

  // The denied socket is passive: only the other participant sends after
  // the DB mutation completes. A local-only disconnect misses remoteIdle.
  it.each([
    ['expert', 'chat.send'],
    ['expert', 'chat.typing'],
    ['client', 'chat.send'],
    ['client', 'chat.typing'],
  ] as const)(
    '%s passive recipient gets no %s after denial on either instance',
    async (kind, action) => {
      const index = kind === 'expert' ? 1 : 0;
      const sender = await ready(tokens[1 - index]);
      const localIdle = await ready(tokens[index]);
      const remoteIdle = await ready(tokens[index], remoteWsUrl);
      const received: unknown[] = [];
      for (const socket of [localIdle, remoteIdle]) {
        socket.on('chat.message', (value) => received.push(value));
        socket.on('chat.typing', (value) => received.push(value));
      }
      await denyAccount(kind);
      const outcomes = [localIdle, remoteIdle].map((socket) =>
        outcome([
          [socket, 'disconnect'],
          [socket, 'chat.message'],
          [socket, 'chat.typing'],
        ]),
      );
      const echo =
        action === 'chat.send' ? event(sender, 'chat.message') : null;
      sender.emit(action, { consultationId, text: 'only active peer' });
      const results = await Promise.all(outcomes);
      if (echo) expect((await echo).text).toBe('only active peer');
      expect(results).toEqual(['disconnect', 'disconnect']);
      expect(received).toEqual([]);
      expect(sender.connected).toBe(true);
      expect(
        await prisma.chatMessage.count({ where: { consultationId } }),
      ).toBe(action === 'chat.send' ? 1 : 0);
    },
  );

  it('active remote recipient receives typing and expert-room events', async () => {
    const sender = await ready(tokens[0]);
    const recipient = await ready(tokens[1], remoteWsUrl);
    const typing = event(recipient, 'chat.typing');
    sender.emit('chat.typing', { consultationId });
    expect(await typing).toEqual({ consultationId, senderRole: 'client' });
    const update = event(recipient, 'payout.updated');
    app
      .get(EventsService)
      .emitToExpert(expertId, 'payout.updated', { id: 'e292' });
    expect(await update).toEqual({ id: 'e292' });
  });

  it.each(['expert', 'client'] as const)(
    '%s passive notification recipient is disconnected without losing notification/outbox',
    async (kind) => {
      const index = kind === 'expert' ? 1 : 0;
      const recipient = await ready(tokens[index], remoteWsUrl);
      await denyAccount(kind);
      const result = outcome([
        [recipient, 'disconnect'],
        [recipient, 'notification.new'],
      ]);
      await app
        .get(NotificationsService)
        .dispatch(users[index], 'chat.message', {
          consultationId,
        });
      expect(await result).toBe('disconnect');
      const notification = await prisma.notification.findFirstOrThrow({
        where: { userId: users[index], type: 'chat.message' },
        orderBy: { createdAt: 'desc' },
      });
      expect(
        await prisma.notificationOutbox.count({
          where: { notificationId: notification.id },
        }),
      ).toBe(1);
    },
  );

  it.each(['user', 'expert', 'expert-resolution', 'missing-expert'] as const)(
    '%s lookup failure drops the event and disconnects both recipient sockets',
    async (target) => {
      const local = await ready(tokens[1]);
      const remote = await ready(tokens[1], remoteWsUrl);
      const result = Promise.all(
        [local, remote].map((socket) =>
          outcome([
            [socket, 'disconnect'],
            [socket, 'earning.credited'],
          ]),
        ),
      );
      if (target === 'missing-expert') {
        jest.spyOn(prisma.expert, 'findUnique').mockResolvedValueOnce(null);
      } else if (target === 'expert-resolution') {
        jest
          .spyOn(prisma.expert, 'findUnique')
          .mockRejectedValueOnce(new Error('E292 DB unavailable'));
      } else {
        jest
          .spyOn(prisma.user, 'findUnique')
          .mockRejectedValueOnce(new Error('E292 DB unavailable'));
      }
      const events = app.get(EventsService);
      if (target === 'user')
        events.emitToUser(users[1], 'earning.credited', { amount: 1 });
      else events.emitToExpert(expertId, 'earning.credited', { amount: 1 });
      expect(await result).toEqual(['disconnect', 'disconnect']);
    },
  );

  it('unblock allows a fresh passive socket to receive again', async () => {
    const sender = await ready(tokens[0]);
    const old = await ready(tokens[1], remoteWsUrl);
    await blockExpert();
    const denied = outcome([
      [old, 'disconnect'],
      [old, 'chat.typing'],
    ]);
    sender.emit('chat.typing', { consultationId });
    expect(await denied).toBe('disconnect');
    await post(admin.token, `/v1/admin/experts/${expertId}/unblock`).expect(
      200,
    );
    const fresh = await ready(tokens[1], remoteWsUrl);
    const message = event(fresh, 'chat.message');
    sender.emit('chat.send', { consultationId, text: 'after unblock' });
    expect((await message).text).toBe('after unblock');
  });

  it('a pending recipient check cannot hold notification persistence/outbox', async () => {
    const recipient = await ready(tokens[0]);
    let rejectCheck!: (error: Error) => void;
    const pending = new Promise<void>((_resolve, reject) => {
      rejectCheck = reject;
    });
    jest
      .spyOn(app.get(AccountAccessService), 'assertActive')
      .mockReturnValueOnce(pending);
    const disconnected = outcome([
      [recipient, 'disconnect'],
      [recipient, 'notification.new'],
    ]);
    try {
      await app
        .get(NotificationsService)
        .dispatch(users[0], 'chat.message', { consultationId });
      const row = await prisma.notification.findFirstOrThrow({
        where: { userId: users[0] },
        orderBy: { createdAt: 'desc' },
      });
      expect(
        await prisma.notificationOutbox.count({
          where: { notificationId: row.id },
        }),
      ).toBe(1);
    } finally {
      rejectCheck(new Error('E292 delayed DB failure'));
      expect(await disconnected).toBe('disconnect');
    }
  });

  it('a realtime emit failure does not prevent notification/outbox persistence', async () => {
    await ready(tokens[0]);
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest
      .spyOn(app.get(EventsGateway).server, 'to')
      .mockImplementationOnce(() => {
        throw new Error('E292 transport unavailable');
      });
    await app
      .get(NotificationsService)
      .dispatch(users[0], 'chat.message', { consultationId });
    const row = await prisma.notification.findFirstOrThrow({
      where: { userId: users[0] },
      orderBy: { createdAt: 'desc' },
    });
    expect(
      await prisma.notificationOutbox.count({
        where: { notificationId: row.id },
      }),
    ).toBe(1);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('E292 transport unavailable'),
      expect.any(String),
    );
  });

  it.each(['user', 'expert'] as const)(
    '%s room keeps FIFO across Redis while another room remains independent',
    async (kind) => {
      const local = await ready(tokens[1]);
      const remote = await ready(tokens[1], remoteWsUrl);
      const unrelated = await ready(tokens[2], remoteWsUrl);
      const received: string[][] = [[], []];
      const completed = [local, remote].flatMap((socket, index) => {
        socket.on('offer.new', () => received[index].push('offer.new'));
        socket.on('offer.revoked', () => received[index].push('offer.revoked'));
        return [event(socket, 'offer.new'), event(socket, 'offer.revoked')];
      });
      let release!: () => void;
      let started!: () => void;
      const delayed = new Promise<void>((resolve) => {
        release = resolve;
      });
      const checking = new Promise<void>((resolve) => {
        started = resolve;
      });
      const access = app.get(AccountAccessService);
      const check = access.assertActive.bind(access);
      jest
        .spyOn(access, 'assertActive')
        .mockImplementationOnce(async (userId) => {
          started();
          await delayed;
          await check(userId);
        });
      const events = app.get(EventsService);
      const send = (name: string) =>
        kind === 'user'
          ? events.emitToUser(users[1], name, { offerId: 'fifo' })
          : events.emitToExpert(expertId, name, { offerId: 'fifo' });
      let beforeRelease: string[][];
      try {
        send('offer.new');
        await checking;
        send('offer.revoked');
        const marker = event(unrelated, 'fifo.marker');
        events.emitToUser(users[2], 'fifo.marker', {});
        await marker;
        beforeRelease = received.map((items) => [...items]);
      } finally {
        release();
      }
      await Promise.all(completed);
      expect(beforeRelease).toEqual([[], []]);
      expect(received).toEqual([
        ['offer.new', 'offer.revoked'],
        ['offer.new', 'offer.revoked'],
      ]);
    },
  );

  it('unrelated participant remains denied on HTTP and WS', async () => {
    await get(tokens[2], messagesPath()).expect(404);
    const stranger = await ready(tokens[2]);
    const error = event(stranger, 'chat.error');
    stranger.emit('chat.send', { consultationId, text: 'forbidden' });
    expect(await error).toEqual({ code: 'CONSULTATION_NOT_FOUND' });
    expect(await prisma.chatMessage.count({ where: { consultationId } })).toBe(
      0,
    );
  });

  it('admin unblock restores access with the same still-valid JWT', async () => {
    await blockExpert();
    await get(tokens[1], messagesPath()).expect(403);
    await post(admin.token, `/v1/admin/experts/${expertId}/unblock`).expect(
      200,
    );
    await get(tokens[1], messagesPath()).expect(200);
    const peer = await ready(tokens[0]);
    const expert = await ready(tokens[1]);
    const received = event(peer, 'chat.message');
    expert.emit('chat.send', { consultationId, text: 'restored' });
    expect((await received).text).toBe('restored');
  });

  it.each(['DRAFT', 'PENDING'] as const)(
    '%s expert keeps onboarding HTTP and WS access',
    async (verificationStatus) => {
      await prisma.expert.update({
        where: { id: expertId },
        data: { verificationStatus },
      });
      await get(tokens[1], '/v1/experts/me').expect(200);
      await request(app.getHttpServer())
        .patch('/v1/experts/me')
        .auth(tokens[1], { type: 'bearer' })
        .send({ city: 'Астана' })
        .expect(200);
      await ready(tokens[1]);
    },
  );

  it('deleted account cannot use OptionalJwtAuthGuard as an anonymous fallback', async () => {
    await denyAccount('client');
    await post(tokens[0], '/v1/tickets').send({}).expect(401);
  });

  it('admin JWT is not a user WS credential', async () => {
    const socket = connect(admin.token);
    const disconnected = event(socket, 'disconnect');
    socket.connect();
    await disconnected;
  });
});
