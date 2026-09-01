/**
 * Нагрузочный сценарий эпика E11: 500 онлайн-экспертов и 200 одновременных
 * консультаций (мастер-план, раздел E11).
 *
 * Гоняется против ЗАПУЩЕННОГО сервера (`npm run start:prod`) и его базы —
 * это не e2e-спек: измеряется поведение реального процесса под
 * параллельной нагрузкой, а не корректность логики (её проверяют 448 e2e).
 *
 * Что имитируется:
 *   Фаза A — 500 экспертов выходят онлайн (`PATCH /experts/me/work-status`)
 *            и держат WebSocket-соединение, как настоящее приложение.
 *   Фаза B — 200 клиентов одновременно создают заявки; эксперт, которому
 *            матчинг прислал `offer.new`, принимает оффер; клиент узнаёт
 *            о матче событием `request.updated`; стороны обмениваются
 *            сообщениями в чате; эксперт завершает консультацию с исходом.
 *
 * Подготовка данных идёт напрямую через Prisma, а токены подписываются
 * тем же секретом, что и у сервера: прогонять 700 SMS-логинов ради выхода
 * на старт бессмысленно — bcrypt на кодах занял бы больше времени, чем сам
 * замер, и мерил бы не то.
 *
 * Запуск и интерпретация: см. loadtest/README.md.
 */
import { PrismaClient, VerificationStatus, WorkStatus } from '@prisma/client';
import { io, Socket } from 'socket.io-client';
import { createHmac } from 'node:crypto';
import { MetricSet, pooled } from './metrics';

const BASE_URL = process.env.LOADTEST_BASE_URL ?? 'http://localhost:3000/v1';
const WS_URL = process.env.LOADTEST_WS_URL ?? 'http://localhost:3000/ws';
const EXPERTS = Number(process.env.LOADTEST_EXPERTS ?? 500);
const CONSULTATIONS = Number(process.env.LOADTEST_CONSULTATIONS ?? 200);
const CHAT_MESSAGES = Number(process.env.LOADTEST_CHAT_MESSAGES ?? 4);
// Параллельность подготовительных HTTP-запросов. Сама нагрузка (фаза B)
// идёт без ограничения — в этом её смысл.
const PREPARE_CONCURRENCY = Number(process.env.LOADTEST_PREPARE_POOL ?? 50);
const TOPIC_SLUG = process.env.LOADTEST_TOPIC ?? 'anxiety-stress';
// Метка данных теста: и телефоны, и уборка ходят по этому префиксу, так
// что прогон не задевает ничего, кроме собственных строк.
const PHONE_PREFIX = '+7799';
const EVENT_TIMEOUT_MS = Number(process.env.LOADTEST_EVENT_TIMEOUT ?? 120_000);

const prisma = new PrismaClient();
const metrics = new MetricSet();

interface Actor {
  userId: string;
  token: string;
  phone: string;
  socket?: Socket;
}

interface ExpertActor extends Actor {
  expertId: string;
}

/// Кто принял какую консультацию: заполняется экспертом в момент accept,
/// читается клиентской половиной сценария, которой нужно, чтобы кто-то
/// завершил консультацию с исходом.
const expertByConsultation = new Map<string, ExpertActor>();

function phoneFor(index: number): string {
  // +7799 + 7 цифр: не пересекается с диапазонами e2e-спеков (+7708…, +7710…).
  return `${PHONE_PREFIX}${String(index).padStart(7, '0')}`;
}

/// Подпись access-токена тем же секретом, что у сервера. Собирается
/// вручную, а не через jsonwebtoken: пакет лежит в дереве транзитивно, без
/// типов, и тянуть его в прямые зависимости ради двух строк HMAC не стоит.
function signToken(userId: string, ttlSeconds = 3600): string {
  const secret = process.env.JWT_SECRET;
  if (!secret)
    throw new Error('JWT_SECRET не задан: возьмите его из backend/.env');
  const now = Math.floor(Date.now() / 1000);
  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  const head = encode({ alg: 'HS256', typ: 'JWT' });
  const body = encode({
    sub: userId,
    isGuest: false,
    iat: now,
    exp: now + ttlSeconds,
  });
  const signature = createHmac('sha256', secret)
    .update(`${head}.${body}`)
    .digest('base64url');
  return `${head}.${body}.${signature}`;
}

async function api(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
  }
  return text ? JSON.parse(text) : null;
}

// ---------------------------------------------------------------- уборка

async function cleanup(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { phone: { startsWith: PHONE_PREFIX } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  if (!userIds.length) return;
  const experts = await prisma.expert.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const expertIds = experts.map((e) => e.id);
  const consultations = await prisma.consultation.findMany({
    where: {
      OR: [{ clientUserId: { in: userIds } }, { expertId: { in: expertIds } }],
    },
    select: { id: true },
  });
  const consultationIds = consultations.map((c) => c.id);

  await prisma.chatMessage.deleteMany({
    where: { consultationId: { in: consultationIds } },
  });
  await prisma.expertNote.deleteMany({
    where: { consultationId: { in: consultationIds } },
  });
  await prisma.consultation.deleteMany({
    where: { id: { in: consultationIds } },
  });
  await prisma.requestCandidate.deleteMany({
    where: { expertId: { in: expertIds } },
  });
  await prisma.request.deleteMany({ where: { clientUserId: { in: userIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.expertTopic.deleteMany({
    where: { expertId: { in: expertIds } },
  });
  await prisma.expertScheduleDay.deleteMany({
    where: { expertId: { in: expertIds } },
  });
  await prisma.scheduleException.deleteMany({
    where: { expertId: { in: expertIds } },
  });
  await prisma.expertDocument.deleteMany({
    where: { expertId: { in: expertIds } },
  });
  await prisma.review.deleteMany({ where: { expertId: { in: expertIds } } });
  await prisma.favorite.deleteMany({ where: { expertId: { in: expertIds } } });
  await prisma.auditLog.deleteMany({
    where: { entityId: { in: [...userIds, ...expertIds, ...consultationIds] } },
  });
  await prisma.expert.deleteMany({ where: { id: { in: expertIds } } });
  await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.device.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

// ------------------------------------------------------------ подготовка

async function seed(): Promise<{ experts: ExpertActor[]; clients: Actor[] }> {
  const topic = await prisma.topic.findUnique({ where: { slug: TOPIC_SLUG } });
  if (!topic)
    throw new Error(
      `Тема ${TOPIC_SLUG} не найдена — прогоните prisma/seed.ts на этой базе`,
    );

  const experts: ExpertActor[] = [];
  for (let i = 0; i < EXPERTS; i++) {
    const phone = phoneFor(i);
    const user = await prisma.user.create({ data: { phone } });
    const expert = await prisma.expert.create({
      data: {
        userId: user.id,
        displayName: `Нагрузка ${i}`,
        city: 'Алматы',
        experience: 'FIVE_TO_TEN',
        education: 'КазНУ',
        priceTiyn: 399000,
        languages: ['ru'],
        formats: ['chat', 'audio', 'video'],
        verificationStatus: VerificationStatus.VERIFIED,
        workStatus: WorkStatus.NOT_ACCEPTING,
        topics: { create: { topicId: topic.id } },
      },
    });
    experts.push({
      userId: user.id,
      expertId: expert.id,
      phone,
      token: signToken(user.id),
    });
  }

  const clients: Actor[] = [];
  for (let i = 0; i < CONSULTATIONS; i++) {
    const phone = phoneFor(EXPERTS + i);
    const user = await prisma.user.create({ data: { phone } });
    clients.push({ userId: user.id, phone, token: signToken(user.id) });
  }

  return { experts, clients };
}

/// Сокеты открываются все сразу, без пула: одновременно висящие соединения —
/// это и есть проверяемое свойство.
async function connectSockets(actors: Actor[], label: string): Promise<void> {
  await Promise.all(
    actors.map(
      (actor) =>
        new Promise<void>((resolve, reject) => {
          const started = performance.now();
          const socket = io(WS_URL, {
            auth: { token: actor.token },
            transports: ['websocket'],
            reconnection: false,
          });
          const timer = setTimeout(() => {
            metrics.get(label).fail();
            reject(new Error(`WS connect timeout для ${actor.phone}`));
          }, 60_000);
          socket.on('connect', () => {
            clearTimeout(timer);
            metrics.get(label).record(performance.now() - started);
            actor.socket = socket;
            resolve();
          });
          socket.on('connect_error', (e) => {
            clearTimeout(timer);
            metrics.get(label).fail();
            reject(e);
          });
        }),
    ),
  );
}

// -------------------------------------------------------------- фаза A

// Расписание 24/7: вне графика эксперт в кандидаты не попадает, каким бы
// ни был его workStatus, — presence складывается из обоих условий.
const FULL_WEEK_SCHEDULE = {
  days: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    enabled: true,
    startMin: 0,
    endMin: 1440,
  })),
};

async function goOnline(experts: ExpertActor[]): Promise<void> {
  await pooled(experts, PREPARE_CONCURRENCY, async (expert) => {
    await api(expert.token, 'PUT', '/experts/me/schedule', FULL_WEEK_SCHEDULE);
    await metrics
      .get('A. PATCH /experts/me/work-status (выход онлайн)')
      .measure(() =>
        api(expert.token, 'PATCH', '/experts/me/work-status', {
          workStatus: 'ACCEPTING',
        }),
      );
  });
}

/// Эксперт живёт как настоящее приложение: пришёл `offer.new` — принял.
/// Матчинг сам решает, кому уходит оффер, поэтому слушают все.
function armExperts(experts: ExpertActor[]): void {
  for (const expert of experts) {
    expert.socket?.on('offer.new', (payload: { offerId: string }) => {
      void metrics
        .get('B. POST /offers/:id/accept (консультация создана)')
        .measure(() =>
          api(expert.token, 'POST', `/offers/${payload.offerId}/accept`),
        )
        .then((accepted: { consultationId?: string }) => {
          if (accepted?.consultationId)
            expertByConsultation.set(accepted.consultationId, expert);
        })
        .catch((e) => {
          // Оффер мог быть отозван ротацией, пока летел ответ, — это
          // штатный исход, а не сбой нагрузки; молчать всё же нельзя.
          console.warn(`accept не прошёл у ${expert.phone}: ${e}`);
        });
    });
  }
}

// -------------------------------------------------------------- фаза B

/// Ждём событие сокета с таймаутом: висеть вечно нагрузочный тест не имеет
/// права — иначе непонятно, он ещё работает или уже сломался.
function waitFor<T>(
  socket: Socket,
  event: string,
  predicate: (payload: T) => boolean,
  timeoutMs = EVENT_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const handler = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Не дождались ${event} за ${timeoutMs} мс`));
    }, timeoutMs);
    socket.on(event, handler);
  });
}

/// HTTP-ответ на accept приходит эксперту уже после того, как клиент
/// получил `request.updated`, поэтому карта может отставать на десятки
/// миллисекунд. Ждём, а не считаем это сбоем.
async function expertOf(consultationId: string): Promise<ExpertActor> {
  const deadline = Date.now() + 30_000;
  for (;;) {
    const expert = expertByConsultation.get(consultationId);
    if (expert) return expert;
    if (Date.now() > deadline)
      throw new Error(`не нашли эксперта консультации ${consultationId}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

async function runConsultation(client: Actor): Promise<void> {
  const matched = waitFor<{
    id: string;
    status: string;
    consultationId?: string;
  }>(
    client.socket!,
    'request.updated',
    (p) => p.status === 'MATCHED' && !!p.consultationId,
  );

  await metrics.get('B. POST /requests (заявка клиента)').measure(() =>
    api(client.token, 'POST', '/requests', {
      topicSlug: TOPIC_SLUG,
      format: 'chat',
    }),
  );

  const event = await metrics
    .get('B. заявка → MATCHED (матчинг, оффер, приём)')
    .measure(() => matched);
  const consultationId = event.consultationId!;
  const expert = await expertOf(consultationId);

  // Чат: клиент пишет через сокет, ждём доставку эксперту. Замеряется
  // полный круг «отправил -> сервер зашифровал, сохранил, разослал».
  for (let i = 0; i < CHAT_MESSAGES; i++) {
    const text = `нагрузочное сообщение ${i} для ${consultationId}`;
    await metrics
      .get('B. chat.send → chat.message (круг)')
      .measure(async () => {
        const delivered = waitFor<{ text: string }>(
          expert.socket!,
          'chat.message',
          (m) => m.text === text,
        );
        client.socket!.emit('chat.send', { consultationId, text });
        await delivered;
      });
  }

  await metrics.get('B. POST /consultations/:id/complete').measure(() =>
    api(expert.token, 'POST', `/consultations/${consultationId}/complete`, {
      outcome: 'COMPLETED',
    }),
  );
}

// ---------------------------------------------------------------- прогон

async function main(): Promise<void> {
  console.log(
    `Нагрузка: ${EXPERTS} экспертов онлайн, ${CONSULTATIONS} консультаций, ` +
      `${CHAT_MESSAGES} сообщений в каждой. Цель: ${BASE_URL}`,
  );

  console.log('Уборка данных прошлого прогона…');
  await cleanup();

  console.log('Подготовка актёров…');
  const preparedAt = performance.now();
  const { experts, clients } = await seed();
  console.log(
    `  создано за ${((performance.now() - preparedAt) / 1000).toFixed(1)} с`,
  );

  console.log('Фаза A: выход экспертов онлайн…');
  const phaseAStarted = performance.now();
  await goOnline(experts);
  await connectSockets(experts, 'A. WebSocket connect (эксперты)');
  armExperts(experts);
  const phaseA = (performance.now() - phaseAStarted) / 1000;

  const onlineCount = await metrics
    .get('A. GET /matching/online-count')
    .measure(() =>
      api(
        clients[0].token,
        'GET',
        `/matching/online-count?topicSlug=${TOPIC_SLUG}&format=chat`,
      ),
    );
  console.log(
    `  фаза A за ${phaseA.toFixed(1)} с; сервер видит онлайн: ` +
      `${JSON.stringify(onlineCount)}`,
  );

  await connectSockets(clients, 'B. WebSocket connect (клиенты)');

  console.log('Фаза B: одновременные консультации…');
  const phaseBStarted = performance.now();
  const results = await Promise.allSettled(
    clients.map((client) => runConsultation(client)),
  );
  const phaseB = (performance.now() - phaseBStarted) / 1000;

  const failed = results.filter((r) => r.status === 'rejected');
  console.log(
    `  фаза B за ${phaseB.toFixed(1)} с: успешно ${results.length - failed.length} ` +
      `из ${results.length}`,
  );
  for (const f of failed.slice(0, 5)) {
    console.log(`  ! ${(f as PromiseRejectedResult).reason}`);
  }

  metrics.table();
  console.log('\nMarkdown-таблица для отчёта:\n');
  console.log(metrics.markdown());

  for (const actor of [...experts, ...clients]) actor.socket?.disconnect();

  if (process.env.LOADTEST_KEEP !== 'true') {
    console.log('Уборка…');
    await cleanup();
  }
  await prisma.$disconnect();

  const failures = metrics.totalFailures() + failed.length;
  if (failures > 0) {
    console.error(`Прогон завершён с ошибками: ${failures}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
