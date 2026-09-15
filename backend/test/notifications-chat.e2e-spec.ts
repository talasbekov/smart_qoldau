import {
  holdConsultation,
  cleanupPaidConsultations,
} from './utils/paid-consultation';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { acceptingExpert as acceptingExpertHelper } from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';
import { flushPushOutbox } from './utils/outbox-helpers';

// Номера спека задачи 7 (E9, чат-пуш офлайн-получателю), не пересекаются с
// другими спеками.
const PH_E1 = '+77098000001';
const PH_C1 = '+77098000091';
const ALL_PHONES = [PH_E1, PH_C1];

const MESSAGE_TEXT = 'У меня очень личный вопрос про панические атаки';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    lastCode = match ? match[1] : '';
  }
}

function post(token: string, url: string) {
  return request(app.getHttpServer())
    .post(url)
    .set('Authorization', `Bearer ${token}`);
}
function get(token: string, url: string) {
  return request(app.getHttpServer())
    .get(url)
    .set('Authorization', `Bearer ${token}`);
}

function waitForEvent(
  socket: Socket,
  event: string,
  timeoutMs = 3000,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for event "${event}"`));
    }, timeoutMs);
    socket.once(event, (payload: unknown) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

let app: INestApplication;
let wsUrl: string;
const openSockets: Socket[] = [];

function connect(token: string): Socket {
  const socket = io(wsUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
  });
  openSockets.push(socket);
  return socket;
}

describe('Чат-пуш офлайн-получателю, без текста сообщения (E9, задача 7)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  const registeredExpertIds: string[] = [];

  async function cleanup() {
    await cleanupPaidConsultations(app);
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
    const consultations = await prisma.consultation.findMany({
      where: {
        OR: [
          { expertId: { in: expertIds } },
          { clientUserId: { in: userIds } },
        ],
      },
      select: { id: true },
    });
    const consultationIds = consultations.map((c) => c.id);
    await prisma.chatMessage.deleteMany({
      where: { consultationId: { in: consultationIds } },
    });
    await prisma.notification.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.device.deleteMany({ where: { userId: { in: userIds } } });
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
    await prisma.consultation.deleteMany({
      where: { id: { in: consultationIds } },
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

    const keys = await redis.keys('mockpush:*');
    if (keys.length) await redis.del(...keys);
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);

    // Реальный порт (не supertest-эфемерный) — нужен настоящий сокет для
    // socket.io-client.
    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    wsUrl = `http://127.0.0.1:${address.port}/ws`;
  });

  beforeEach(() => cleanup());

  afterEach(() => {
    for (const s of openSockets.splice(0)) {
      s.disconnect();
    }
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function acceptingExpert(phone: string) {
    const result = await acceptingExpertHelper(app, phone, () => lastCode);
    registeredExpertIds.push(result.expertId);
    return result;
  }

  async function clientUser(phone: string) {
    return clientUserHelper(app, phone, () => lastCode);
  }

  async function userIdByExpertId(expertId: string): Promise<string> {
    const expert = await prisma.expert.findUniqueOrThrow({
      where: { id: expertId },
    });
    return expert.userId;
  }

  async function matchClientToExpert(
    cli: { accessToken: string },
    exp: { accessToken: string; expertId: string },
  ) {
    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
    const offers = await get(exp.accessToken, '/v1/experts/me/offers').expect(
      200,
    );
    const offerId = offers.body[0].offerId as string;
    const accepted = await post(
      exp.accessToken,
      `/v1/offers/${offerId}/accept`,
    ).expect(200);
    await holdConsultation(app, accepted.body.consultationId);
    return {
      requestId: r.body.id as string,
      consultationId: accepted.body.consultationId as string,
    };
  }

  async function addDevice(accessToken: string, token: string) {
    await request(app.getHttpServer())
      .post('/v1/devices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ platform: 'android', token })
      .expect(201);
  }

  async function pushSentTo(token: string): Promise<any[]> {
    // Пуши уходят из очереди (E11a, задача 3): перед чтением
    // прокручиваем тик — в бою это делает @Interval(1000).
    await flushPushOutbox(app);
    const sent = await redis.lrange(`mockpush:sent:${token}`, 0, -1);
    return sent.map((s) => JSON.parse(s));
  }

  // Устройство может получить и другие пуши эпика (например, offer.incoming
  // при выдаче оффера) — ищем именно тот, что относится к проверяемому
  // Notification.
  function pushForNotification(sent: any[], notificationId: string): any {
    const found = sent.find((s) => s.data?.notificationId === notificationId);
    expect(found).toBeDefined();
    return found;
  }

  // dispatch() внутри chat.send-хендлера — fire-and-forget относительно
  // сокет-эха (см. events.gateway.ts), поэтому опрашиваем БД вместо
  // ожидания WS-события.
  async function waitForNotification(
    userId: string,
    type: string,
    timeoutMs = 3000,
  ): Promise<any> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = await prisma.notification.findFirst({
        where: { userId, type },
      });
      if (found) {
        // Запись появилась — теперь прокручиваем тик очереди пушей
        // (E11a, задача 3) и перечитываем: `pushSentAt` проставляет
        // именно sweep, а не путь запроса.
        await flushPushOutbox(app);
        return prisma.notification.findFirstOrThrow({
          where: { id: found.id },
        });
      }
      if (Date.now() > deadline) {
        throw new Error(
          `Timed out waiting for notification type=${type} userId=${userId}`,
        );
      }
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  it('офлайн-получатель (эксперт не подключён): клиент шлёт сообщение -> эксперту push + in-app запись chat.message, без текста', async () => {
    const exp = await acceptingExpert(PH_E1);
    const expertUserId = await userIdByExpertId(exp.expertId);
    await addDevice(exp.accessToken, 'chat-tok-e1');
    const cli = await clientUser(PH_C1);
    const { consultationId } = await matchClientToExpert(cli, exp);

    // Только клиент онлайн — эксперт НЕ подключён к WS ни одним сокетом.
    const clientSocket = connect(cli.accessToken);
    await waitForEvent(clientSocket, 'ready');

    const clientEchoPromise = waitForEvent(clientSocket, 'chat.message');
    clientSocket.emit('chat.send', {
      consultationId,
      text: MESSAGE_TEXT,
    });
    // Живой чат (WS chat.message) продолжает работать как раньше.
    const echoPayload = await clientEchoPromise;
    expect(echoPayload.text).toBe(MESSAGE_TEXT);

    const stored = await waitForNotification(expertUserId, 'chat.message');
    expect(stored.title).toBe('Новое сообщение');
    expect(stored.body).toBe('Откройте чат консультации');
    expect(stored.data).toMatchObject({ consultationId });
    expect(stored.pushSentAt).not.toBeNull();

    // PII §5.8: текста сообщения нет НИГДЕ в in-app записи.
    const storedJson = JSON.stringify({
      title: stored.title,
      body: stored.body,
      data: stored.data,
    });
    expect(storedJson).not.toContain(MESSAGE_TEXT);
    expect((stored.data as any).text).toBeUndefined();

    const sent = await pushSentTo('chat-tok-e1');
    const push = pushForNotification(sent, stored.id);
    expect(push.title).toBe('Новое сообщение');
    expect(push.body).toBe('Откройте чат консультации');
    expect(push.data.consultationId).toBe(consultationId);

    // PII §5.8: текста сообщения нет НИГДЕ в пуше (ни title/body, ни data).
    expect(JSON.stringify(push)).not.toContain(MESSAGE_TEXT);
    expect(push.data.text).toBeUndefined();
  });

  it('онлайн-получатель (эксперт подключён): push НЕ шлётся, in-app запись не создаётся — центр не дублирует живой чат', async () => {
    const exp = await acceptingExpert(PH_E1);
    const expertUserId = await userIdByExpertId(exp.expertId);
    await addDevice(exp.accessToken, 'chat-tok-e1-online');
    const cli = await clientUser(PH_C1);
    const { consultationId } = await matchClientToExpert(cli, exp);

    const clientSocket = connect(cli.accessToken);
    const expertSocket = connect(exp.accessToken);
    await waitForEvent(clientSocket, 'ready');
    await waitForEvent(expertSocket, 'ready');

    const expertMsgPromise = waitForEvent(expertSocket, 'chat.message');
    clientSocket.emit('chat.send', {
      consultationId,
      text: 'Обычное сообщение, получатель онлайн',
    });
    // Живой чат по-прежнему доставляет сообщение получателю.
    await expertMsgPromise;

    // Дать событийному циклу шанс завершить (несостоявшийся) fire-and-forget
    // dispatch, прежде чем проверять его отсутствие.
    await new Promise((r) => setTimeout(r, 500));

    await flushPushOutbox(app);

    const stored = await prisma.notification.findFirst({
      where: { userId: expertUserId, type: 'chat.message' },
    });
    expect(stored).toBeNull();

    const sent = await pushSentTo('chat-tok-e1-online');
    expect(sent.find((s) => s.data?.type === 'chat.message')).toBeUndefined();
  });

  it('многосокетный получатель: один из двух сокетов отключился, второй жив -> получатель всё ещё онлайн, push не шлётся', async () => {
    const exp = await acceptingExpert(PH_E1);
    const expertUserId = await userIdByExpertId(exp.expertId);
    await addDevice(exp.accessToken, 'chat-tok-e1-multi');
    const cli = await clientUser(PH_C1);
    const { consultationId } = await matchClientToExpert(cli, exp);

    const clientSocket = connect(cli.accessToken);
    const expertSocketA = connect(exp.accessToken);
    const expertSocketB = connect(exp.accessToken);
    await waitForEvent(clientSocket, 'ready');
    await waitForEvent(expertSocketA, 'ready');
    await waitForEvent(expertSocketB, 'ready');

    // Первая вкладка эксперта закрывается, вторая остаётся живой.
    expertSocketA.disconnect();
    await new Promise((r) => setTimeout(r, 200));

    const expertMsgPromise = waitForEvent(expertSocketB, 'chat.message');
    clientSocket.emit('chat.send', {
      consultationId,
      text: 'Сообщение при частично отключённом эксперте',
    });
    await expertMsgPromise;

    await new Promise((r) => setTimeout(r, 500));

    await flushPushOutbox(app);

    const stored = await prisma.notification.findFirst({
      where: { userId: expertUserId, type: 'chat.message' },
    });
    expect(stored).toBeNull();
  });
});
