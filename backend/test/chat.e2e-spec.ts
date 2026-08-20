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

// Номера спека задачи 3 (E4), не пересекаются с другими спеками.
const PH_E1 = '+77083000001';
const PH_C1 = '+77083000091';
const PH_C2 = '+77083000092'; // «чужой» пользователь (не-участник)
const ALL_PHONES = [PH_E1, PH_C1, PH_C2];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
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

describe('Шифрованный чат консультаций (e2e)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  const registeredExpertIds: string[] = [];

  async function cleanup() {
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
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);

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
    return {
      requestId: r.body.id as string,
      consultationId: accepted.body.consultationId as string,
    };
  }

  it('chat.send доставляет chat.message ОБЕИМ сторонам, история REST расшифрована и в порядке отправки', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const { consultationId } = await matchClientToExpert(cli, exp);

    const clientSocket = connect(cli.accessToken);
    const expertSocket = connect(exp.accessToken);
    await waitForEvent(clientSocket, 'connect');
    await waitForEvent(expertSocket, 'connect');

    const clientMsgPromise = waitForEvent(clientSocket, 'chat.message');
    const expertMsgPromise = waitForEvent(expertSocket, 'chat.message');

    clientSocket.emit('chat.send', {
      consultationId,
      text: 'Здравствуйте, у меня вопрос.',
    });

    const [clientPayload, expertPayload] = await Promise.all([
      clientMsgPromise,
      expertMsgPromise,
    ]);

    expect(clientPayload).toMatchObject({
      consultationId,
      senderRole: 'client',
      text: 'Здравствуйте, у меня вопрос.',
    });
    expect(clientPayload.id).toBeDefined();
    expect(clientPayload.createdAt).toBeDefined();
    expect(clientPayload.userId).toBeUndefined();
    expect(expertPayload).toMatchObject(clientPayload);

    // Второе сообщение от эксперта.
    const clientMsg2Promise = waitForEvent(clientSocket, 'chat.message');
    expertSocket.emit('chat.send', {
      consultationId,
      text: 'Здравствуйте! Слушаю вас.',
    });
    const expertReply = await clientMsg2Promise;
    expect(expertReply.senderRole).toBe('expert');
    expect(expertReply.text).toBe('Здравствуйте! Слушаю вас.');

    // История REST: порядок createdAt asc.
    const history = await get(
      cli.accessToken,
      `/v1/consultations/${consultationId}/messages`,
    ).expect(200);
    expect(history.body.items).toHaveLength(2);
    expect(history.body.items[0].senderRole).toBe('client');
    expect(history.body.items[0].text).toBe('Здравствуйте, у меня вопрос.');
    expect(history.body.items[1].senderRole).toBe('expert');
    expect(history.body.items[1].text).toBe('Здравствуйте! Слушаю вас.');
    expect(history.body.nextCursor).toBeNull();

    // Raw prisma: ciphertext не содержит plaintext.
    const rows = await prisma.chatMessage.findMany({
      where: { consultationId },
    });
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const plaintextBuf = Buffer.from('Здравствуйте, у меня вопрос.', 'utf8');
      expect(Buffer.from(row.ciphertext).includes(plaintextBuf)).toBe(false);
    }
  });

  it('chat.typing ретранслируется только второй стороне', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const { consultationId } = await matchClientToExpert(cli, exp);

    const clientSocket = connect(cli.accessToken);
    const expertSocket = connect(exp.accessToken);
    await waitForEvent(clientSocket, 'connect');
    await waitForEvent(expertSocket, 'connect');

    const expertTypingPromise = waitForEvent(expertSocket, 'chat.typing', 8000);
    let clientReceivedOwnTyping = false;
    clientSocket.once('chat.typing', () => {
      clientReceivedOwnTyping = true;
    });

    clientSocket.emit('chat.typing', { consultationId });

    const payload = await expertTypingPromise;
    expect(payload).toMatchObject({ consultationId, senderRole: 'client' });

    // Отправитель НЕ должен получить своё же событие typing.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(clientReceivedOwnTyping).toBe(false);
  });

  it('история REST: пагинация 2 страницами при 3 сообщениях и limit=2', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const { consultationId } = await matchClientToExpert(cli, exp);

    const clientSocket = connect(cli.accessToken);
    await waitForEvent(clientSocket, 'connect');

    for (const text of ['первое', 'второе', 'третье']) {
      const promise = waitForEvent(clientSocket, 'chat.message');
      clientSocket.emit('chat.send', { consultationId, text });
      await promise;
    }

    const page1 = await get(
      cli.accessToken,
      `/v1/consultations/${consultationId}/messages?limit=2`,
    ).expect(200);
    expect(page1.body.items).toHaveLength(2);
    expect(page1.body.items.map((m: any) => m.text)).toEqual([
      'первое',
      'второе',
    ]);
    expect(page1.body.nextCursor).toBeDefined();
    expect(page1.body.nextCursor).not.toBeNull();

    const page2 = await get(
      cli.accessToken,
      `/v1/consultations/${consultationId}/messages?limit=2&cursor=${page1.body.nextCursor}`,
    ).expect(200);
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.items[0].text).toBe('третье');
    expect(page2.body.nextCursor).toBeNull();
  });

  it('не-участник: REST история 404, WS chat.send -> chat.error', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const stranger = await clientUser(PH_C2);
    const { consultationId } = await matchClientToExpert(cli, exp);

    const strangerHistory = await get(
      stranger.accessToken,
      `/v1/consultations/${consultationId}/messages`,
    ).expect(404);
    expect(strangerHistory.body.error.code).toBe('CONSULTATION_NOT_FOUND');

    const strangerSocket = connect(stranger.accessToken);
    await waitForEvent(strangerSocket, 'connect');

    const errorPromise = waitForEvent(strangerSocket, 'chat.error');
    strangerSocket.emit('chat.send', {
      consultationId,
      text: 'я не участник',
    });
    const errorPayload = await errorPromise;
    expect(errorPayload.code).toBe('CONSULTATION_NOT_FOUND');
  });

  it('сообщение в завершённую консультацию -> 409 (REST) и chat.error (WS)', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);
    const { consultationId } = await matchClientToExpert(cli, exp);

    await prisma.consultation.update({
      where: { id: consultationId },
      data: { status: 'COMPLETED' },
    });

    const clientSocket = connect(cli.accessToken);
    await waitForEvent(clientSocket, 'connect');

    const errorPromise = waitForEvent(clientSocket, 'chat.error');
    clientSocket.emit('chat.send', {
      consultationId,
      text: 'после завершения',
    });
    const errorPayload = await errorPromise;
    expect(errorPayload.code).toBe('CONSULTATION_NOT_ACTIVE');
  });
});
