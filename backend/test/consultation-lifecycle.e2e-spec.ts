import {
  holdConsultation,
  cleanupPaidConsultations,
} from './utils/paid-consultation';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AddressInfo } from 'node:net';
import { io, Socket } from 'socket.io-client';
import * as crypto from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { PresenceService } from '../src/presence/presence.service';
import { ClockService } from '../src/common/clock/clock.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { OfferTimerService } from '../src/requests/offer-timer.service';
import { createApp } from './utils/create-app';
import {
  registeredExpertUser,
  putScheduleAlwaysOn,
} from './utils/expert-helpers';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Номера спека задачи 9 (E4, сквозной e2e): не пересекаются с другими
// спеками эпика (задача 5 занимает +7708300000[1-7]/9[1-7], задача 6 —
// +770830100xx, задача 7 — +77084000xxx). Используем отдельный префикс.
const PH_E1 = '+77085000001'; // сценарий 1: эксперт
const PH_C1 = '+77085000091'; // сценарий 1: клиент
const PH_E2 = '+77085000002'; // сценарий 2а: эксперт (no-show)
const PH_C2 = '+77085000092'; // сценарий 2а: клиент
const PH_E3 = '+77085000003'; // сценарий 2б: эксперт (cancel)
const PH_C3 = '+77085000093'; // сценарий 2б: клиент
const ALL_PHONES = [PH_E1, PH_C1, PH_E2, PH_C2, PH_E3, PH_C3];

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
function put(token: string, url: string) {
  return request(app.getHttpServer())
    .put(url)
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

// Виртуальные часы: старт в среду 2026-08-20 10:00 Asia/Almaty (05:00 UTC),
// чтобы расписание 24/7 хелперов всегда покрывало now().
const fakeClock = {
  current: new Date('2026-08-20T05:00:00Z'),
  now(): Date {
    return new Date(this.current);
  },
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  },
};

let app: INestApplication;
let wsUrl: string;
let apiKey: string;
let apiSecret: string;
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

// Подписывает тело вебхука как LiveKit-сервер: sha256(body) в base64 в claim
// AccessToken.sha256, JWT в Authorization (см. media.e2e-spec.ts).
async function signWebhook(bodyString: string): Promise<string> {
  const hash = crypto.createHash('sha256').update(bodyString).digest('base64');
  const at = new AccessToken(apiKey, apiSecret, {});
  at.sha256 = hash;
  return at.toJwt();
}

function webhookBody(
  event: 'participant_joined' | 'participant_left',
  roomName: string,
  identity: string,
): string {
  return JSON.stringify({
    event,
    room: { name: roomName },
    participant: { identity },
  });
}

describe('Сквозной e2e жизненного цикла консультации (E4, задача 9)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
  let presence: PresenceService;
  let timer: OfferTimerService;
  const registeredExpertIds: string[] = [];
  const clientUserIds: string[] = [];

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
    if (clientUserIds.length) {
      const abuseKeys = clientUserIds.map((id) => `abuse:client:${id}`);
      await redis.del(...abuseKeys);
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
    await prisma.review.deleteMany({
      where: {
        OR: [
          { expertId: { in: expertIds } },
          { clientUserId: { in: userIds } },
        ],
      },
    });
    await prisma.expertNote.deleteMany({
      where: { consultationId: { in: consultationIds } },
    });
    await prisma.chatMessage.deleteMany({
      where: { consultationId: { in: consultationIds } },
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entity: 'request' },
          { entity: 'offer' },
          { entity: 'consultation' },
          { entity: 'review' },
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
    clientUserIds.length = 0;
  }

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
    presence = app.get(PresenceService);
    timer = app.get(OfferTimerService);
    const config = app.get(ConfigService);
    apiKey = config.get<string>('LIVEKIT_API_KEY')!;
    apiSecret = config.get<string>('LIVEKIT_API_SECRET')!;

    await app.listen(0);
    const address = app.getHttpServer().address() as AddressInfo;
    wsUrl = `http://127.0.0.1:${address.port}/ws`;
  });

  beforeEach(async () => {
    fakeClock.current = new Date('2026-08-20T05:00:00Z');
    await cleanup();
  });

  afterEach(() => {
    for (const s of openSockets.splice(0)) {
      s.disconnect();
    }
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  // Как в consultations-complete.e2e-spec.ts/reviews.e2e-spec.ts: обходим
  // верификацию через документы (предсуществующий баг FileTypeValidator из
  // @nestjs/common после апгрейда file-type до 20.x — см. spawn_task
  // task_cc6736f8), переводим эксперта в VERIFIED напрямую через Prisma.
  async function acceptingExpert(phone: string) {
    const result = await registeredExpertUser(app, phone, () => lastCode);
    registeredExpertIds.push(result.expertId);
    await prisma.expert.update({
      where: { id: result.expertId },
      data: { verificationStatus: 'VERIFIED' },
    });
    await request(app.getHttpServer())
      .patch('/v1/experts/me/work-status')
      .set('Authorization', `Bearer ${result.accessToken}`)
      .send({ workStatus: 'ACCEPTING' })
      .expect(200);
    await putScheduleAlwaysOn(app, result.accessToken);
    return result;
  }

  async function clientUser(phone: string) {
    const result = await clientUserHelper(app, phone, () => lastCode);
    clientUserIds.push(result.userId);
    return result;
  }

  async function matchClientToExpert(
    cli: { accessToken: string },
    exp: { accessToken: string; expertId: string },
    format: 'chat' | 'audio' | 'video' = 'chat',
  ) {
    const r = await post(cli.accessToken, '/v1/requests')
      .send({ topicSlug: 'anxiety-stress', format })
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

  it(
    'счастливый путь: заявка -> матч -> консультация (эксперт BUSY) -> ' +
      'чат (2 сообщения) -> эскалация в video + токены -> вебхук join ' +
      'клиента -> complete COMPLETED (эксперт снова ACCEPTING) -> отзыв ' +
      '5* -> рейтинг на карточке -> заметка эксперта; полная audit-цепочка',
    async () => {
      const exp = await acceptingExpert(PH_E1);
      const cli = await clientUser(PH_C1);

      // 1) Заявка -> матч (accept) -> консультация ACTIVE.
      const { consultationId } = await matchClientToExpert(cli, exp, 'chat');

      const consultationAfterMatch =
        await prisma.consultation.findUniqueOrThrow({
          where: { id: consultationId },
        });
      expect(consultationAfterMatch.status).toBe('ACTIVE');
      expect(consultationAfterMatch.format).toBe('chat');

      // Эксперт авто-BUSY и вне presence (Р-13).
      const expertAfterMatch = await prisma.expert.findUniqueOrThrow({
        where: { id: exp.expertId },
      });
      expect(expertAfterMatch.workStatus).toBe('BUSY');
      expect(await presence.isAvailable(exp.expertId)).toBe(false);

      const createdAudit = await prisma.auditLog.findFirst({
        where: {
          entity: 'consultation',
          entityId: consultationId,
          transition: 'consultation.created',
        },
      });
      expect(createdAudit).not.toBeNull();

      // 2) Чат: 2 сообщения через WS-сокеты (клиент -> эксперт, эксперт ->
      // клиент), как в chat.e2e-spec.ts.
      const clientSocket = connect(cli.accessToken);
      const expertSocket = connect(exp.accessToken);
      // 'ready' — сервер подтверждает, что комнаты назначены (см.
      // EventsGateway.handleConnection); 'connect' приходит раньше этого.
      await waitForEvent(clientSocket, 'ready');
      await waitForEvent(expertSocket, 'ready');

      const expertMsgPromise = waitForEvent(expertSocket, 'chat.message');
      clientSocket.emit('chat.send', {
        consultationId,
        text: 'Здравствуйте, у меня вопрос.',
      });
      const expertReceived = await expertMsgPromise;
      expect(expertReceived).toMatchObject({
        consultationId,
        senderRole: 'client',
        text: 'Здравствуйте, у меня вопрос.',
      });

      const clientMsgPromise = waitForEvent(clientSocket, 'chat.message');
      expertSocket.emit('chat.send', {
        consultationId,
        text: 'Здравствуйте! Слушаю вас.',
      });
      const clientReceived = await clientMsgPromise;
      expect(clientReceived).toMatchObject({
        consultationId,
        senderRole: 'expert',
        text: 'Здравствуйте! Слушаю вас.',
      });

      const history = await get(
        cli.accessToken,
        `/v1/consultations/${consultationId}/messages`,
      ).expect(200);
      expect(history.body.items).toHaveLength(2);
      expect(history.body.items[0].text).toBe('Здравствуйте, у меня вопрос.');
      expect(history.body.items[1].text).toBe('Здравствуйте! Слушаю вас.');

      // 3) Эскалация формата chat -> video через media-token.
      await post(
        cli.accessToken,
        `/v1/consultations/${consultationId}/media-token`,
      )
        .send({ format: 'video' })
        .expect(201);

      const escalatedConsultation = await prisma.consultation.findUniqueOrThrow(
        { where: { id: consultationId } },
      );
      expect(escalatedConsultation.format).toBe('video');

      const escalationAudit = await prisma.auditLog.findFirst({
        where: {
          entity: 'consultation',
          entityId: consultationId,
          transition: 'consultation.format_escalated',
        },
      });
      expect(escalationAudit).not.toBeNull();
      expect(escalationAudit!.payload).toMatchObject({
        from: 'chat',
        to: 'video',
      });

      // 4) Вебхук LiveKit: клиент подключился к комнате.
      const roomName = `cons-${consultationId}`;
      const joinBody = webhookBody(
        'participant_joined',
        roomName,
        `client-${escalatedConsultation.clientCode}`,
      );
      const joinAuth = await signWebhook(joinBody);
      await request(app.getHttpServer())
        .post('/v1/webhooks/livekit')
        .set('Authorization', joinAuth)
        .set('Content-Type', 'application/json')
        .send(joinBody)
        .expect(200);

      const afterJoin = await prisma.consultation.findUniqueOrThrow({
        where: { id: consultationId },
      });
      expect(afterJoin.clientJoinedAt).not.toBeNull();

      const joinAudit = await prisma.auditLog.findFirst({
        where: {
          entity: 'consultation',
          entityId: consultationId,
          transition: 'consultation.participant_joined',
        },
      });
      expect(joinAudit).not.toBeNull();
      expect(joinAudit!.payload).toMatchObject({ role: 'client' });

      // 5) complete COMPLETED экспертом -> эксперт снова ACCEPTING + presence.
      fakeClock.advance(12 * 60_000); // 12 минут консультации

      const completeRes = await post(
        exp.accessToken,
        `/v1/consultations/${consultationId}/complete`,
      )
        .send({ outcome: 'COMPLETED' })
        .expect(200);
      expect(completeRes.body.status).toBe('COMPLETED');
      expect(completeRes.body.outcome).toBe('COMPLETED');

      const expertAfterComplete = await prisma.expert.findUniqueOrThrow({
        where: { id: exp.expertId },
      });
      expect(expertAfterComplete.workStatus).toBe('ACCEPTING');
      expect(await presence.isAvailable(exp.expertId)).toBe(true);

      const completeAudit = await prisma.auditLog.findFirst({
        where: {
          entity: 'consultation',
          entityId: consultationId,
          transition: 'consultation.completed',
        },
      });
      expect(completeAudit).not.toBeNull();
      expect(completeAudit!.payload).toMatchObject({
        outcome: 'COMPLETED',
        durationMin: 12,
      });

      // 6) Отзыв 5* с publicText и privateText.
      const reviewRes = await post(
        cli.accessToken,
        `/v1/consultations/${consultationId}/review`,
      )
        .send({
          rating: 5,
          publicText: 'Отличная консультация, спасибо!',
          privateText: 'СЕКРЕТНАЯ ЗАМЕТКА ДЛЯ КОМАНДЫ КАЧЕСТВА',
        })
        .expect(201);
      expect(reviewRes.body.rating).toBe(5);
      expect(JSON.stringify(reviewRes.body)).not.toContain(
        'СЕКРЕТНАЯ ЗАМЕТКА ДЛЯ КОМАНДЫ КАЧЕСТВА',
      );

      // 7) ratingCount=1/avg=5 на публичной карточке эксперта.
      const expertCard = await get(
        cli.accessToken,
        `/v1/experts/${exp.expertId}`,
      ).expect(200);
      expect(expertCard.body.ratingAvg).toBe(5);
      expect(expertCard.body.ratingCount).toBe(1);

      // 8) Заметка эксперта: PUT/GET.
      const noteText = '  Клиент чувствует себя лучше после сессии  ';
      await put(exp.accessToken, `/v1/consultations/${consultationId}/note`)
        .send({ text: noteText })
        .expect(200);
      const noteRes = await get(
        exp.accessToken,
        `/v1/consultations/${consultationId}/note`,
      ).expect(200);
      expect(noteRes.body.text).toBe(
        'Клиент чувствует себя лучше после сессии',
      );
      // Клиенту заметка недоступна (приватна).
      await get(
        cli.accessToken,
        `/v1/consultations/${consultationId}/note`,
      ).expect(404);

      // 9) Финальная audit-цепочка по всем этапам жизненного цикла.
      const fullAudit = await prisma.auditLog.findMany({
        where: {
          entity: 'consultation',
          entityId: consultationId,
        },
        select: { transition: true },
      });
      expect(fullAudit).toEqual(
        expect.arrayContaining([
          { transition: 'consultation.created' },
          { transition: 'consultation.format_escalated' },
          { transition: 'consultation.participant_joined' },
          { transition: 'consultation.completed' },
        ]),
      );
      const reviewAudit = await prisma.auditLog.findFirst({
        where: { entity: 'review', transition: 'review.created' },
      });
      expect(reviewAudit).not.toBeNull();
    },
  );

  it(
    'негативный путь: матч -> клиент не подключился (advance 181с + ' +
      'sweep -> hint) -> complete CLIENT_NO_SHOW -> отзыв невозможен (409) ' +
      '-> эксперт в ACCEPTING; отдельно: отмена клиентом активной ' +
      'консультации -> CANCELLED + abuse-счётчик',
    async () => {
      // --- 2а: no-show ---
      const expA = await acceptingExpert(PH_E2);
      const cliA = await clientUser(PH_C2);
      const { consultationId: consultationIdA } = await matchClientToExpert(
        cliA,
        expA,
        'video',
      );

      fakeClock.advance(181_000); // 3 мин 1 с — за пределами presence TTL (90с)
      await timer.sweep();

      const rowAfterSweep = await prisma.consultation.findUniqueOrThrow({
        where: { id: consultationIdA },
      });
      expect(rowAfterSweep.noShowNotifiedAt).not.toBeNull();

      const noShowAudit = await prisma.auditLog.findFirst({
        where: {
          entity: 'consultation',
          entityId: consultationIdA,
          transition: 'consultation.client_no_show_hint',
        },
      });
      expect(noShowAudit).not.toBeNull();

      const completeNoShow = await post(
        expA.accessToken,
        `/v1/consultations/${consultationIdA}/complete`,
      )
        .send({ outcome: 'CLIENT_NO_SHOW' })
        .expect(200);
      expect(completeNoShow.body.status).toBe('COMPLETED');
      expect(completeNoShow.body.outcome).toBe('CLIENT_NO_SHOW');

      // Отзыв невозможен на CLIENT_NO_SHOW -> 409 CONSULTATION_NOT_COMPLETED.
      const reviewAttempt = await post(
        cliA.accessToken,
        `/v1/consultations/${consultationIdA}/review`,
      )
        .send({ rating: 2 })
        .expect(409);
      expect(reviewAttempt.body.error.code).toBe('CONSULTATION_NOT_COMPLETED');

      const expertAAfter = await prisma.expert.findUniqueOrThrow({
        where: { id: expA.expertId },
      });
      expect(expertAAfter.workStatus).toBe('ACCEPTING');

      // Сценарий 2а закончен: убираем expA из пула кандидатов, иначе его
      // накопленная история (1 успешный ACCEPTED-оффер -> выше score, см.
      // ScoringService Р-12) обойдёт свежезарегистрированного expB в
      // ranked[0] и оффер сценария 2б уйдёт не тому эксперту.
      await request(app.getHttpServer())
        .patch('/v1/experts/me/work-status')
        .set('Authorization', `Bearer ${expA.accessToken}`)
        .send({ workStatus: 'NOT_ACCEPTING' })
        .expect(200);

      // --- 2б: отдельный клиент+эксперт, отмена клиентом ---
      // ВАЖНО: advance(181с) в первой половине протух presence-TTL (90с) для
      // всех ранее touch-нутых экспертов, поэтому регистрируем/touch-аем
      // этого эксперта заново ПОСЛЕ advance.
      const expB = await acceptingExpert(PH_E3);
      const cliB = await clientUser(PH_C3);
      const { consultationId: consultationIdB } = await matchClientToExpert(
        cliB,
        expB,
        'video',
      );

      const cancelRes = await post(
        cliB.accessToken,
        `/v1/consultations/${consultationIdB}/cancel`,
      ).expect(200);
      expect(cancelRes.body.status).toBe('CANCELLED');
      expect(cancelRes.body.outcome).toBe('CLIENT_CANCELLED');

      const rowB = await prisma.consultation.findUniqueOrThrow({
        where: { id: consultationIdB },
      });
      expect(rowB.status).toBe('CANCELLED');
      expect(rowB.outcome).toBe('CLIENT_CANCELLED');

      const abuseKey = `abuse:client:${cliB.userId}`;
      const abuseCount = await redis.get(abuseKey);
      expect(abuseCount).toBe('1');

      const expertBAfter = await prisma.expert.findUniqueOrThrow({
        where: { id: expB.expertId },
      });
      expect(expertBAfter.workStatus).toBe('ACCEPTING');
    },
  );
});
