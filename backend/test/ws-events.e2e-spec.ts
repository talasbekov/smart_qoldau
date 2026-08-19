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

// Номера спека задачи 7 (E3), не пересекаются с другими спеками.
const PH_E1 = '+77070000001';
const PH_C1 = '+77070000091';
const ALL_PHONES = [PH_E1, PH_C1];

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

describe('WebSocket-события заявок (e2e)', () => {
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
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ entity: 'request' }, { entity: 'offer' }],
      },
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

  it('эксперт получает offer.new при создании заявки, без PII', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);

    const expertSocket = connect(exp.accessToken);
    await waitForEvent(expertSocket, 'connect');

    const offerNewPromise = waitForEvent(expertSocket, 'offer.new');

    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);
    expect(r.body.status).toBe('SEARCHING');

    const payload = await offerNewPromise;
    expect(payload).toMatchObject({
      topicSlug: 'anxiety-stress',
      format: 'video',
      isEmergency: false,
      clientCode: expect.any(Number),
    });
    expect(payload.offerId).toBeDefined();
    expect(payload.deadlineAt).toBeDefined();
    expect(JSON.stringify(payload)).not.toMatch(/\+77\d{9}/);
    expect(payload.clientUserId).toBeUndefined();
    expect(payload.phone).toBeUndefined();
  });

  it('клиент получает request.updated MATCHED при accept, с matchedExpert.id', async () => {
    const exp = await acceptingExpert(PH_E1);
    const cli = await clientUser(PH_C1);

    const clientSocket = connect(cli.accessToken);
    await waitForEvent(clientSocket, 'connect');

    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format: 'video' })
      .expect(201);

    const offers = await get(exp.accessToken, '/v1/experts/me/offers').expect(
      200,
    );
    const offerId = offers.body[0].offerId as string;

    const updatedPromise = waitForEvent(clientSocket, 'request.updated');

    await post(exp.accessToken, `/v1/offers/${offerId}/accept`).expect(200);

    const payload = await updatedPromise;
    expect(payload).toMatchObject({
      id: r.body.id,
      status: 'MATCHED',
    });
    expect(payload.matchedExpert.id).toBe(exp.expertId);
    expect(payload.matchedExpert.userId).toBeUndefined();
  });

  it('подключение с мусорным токеном -> disconnect', async () => {
    const socket = connect('this-is-not-a-valid-jwt-token');
    await waitForEvent(socket, 'disconnect', 2000);
  });
});
