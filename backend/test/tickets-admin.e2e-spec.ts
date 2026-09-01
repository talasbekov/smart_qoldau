import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClockService } from '../src/common/clock/clock.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { registeredExpertUser } from './utils/expert-helpers';
import { clientUser } from './utils/client-helpers';
import { adminUser } from './utils/admin-helpers';

// Номера спека задачи 8 (E8a): очередь тикетов, ответы и решение
// сотрудником. Диапазон +77101xxxxxx свободен (не пересекается с другими
// спеками — см. grep по test/*.e2e-spec.ts на момент написания).
const PH_CLIENT_A = '+77101000001';
const PH_EXPERT_B = '+77101000002';
const ALL_PHONES = [PH_CLIENT_A, PH_EXPERT_B];

// Префикс-метка этого спека (E8a, задача 8): admin_users могут содержать
// строки от прошлых прогонов — спек не предполагает пустоты таблицы и
// убирает только свои строки.
const ADMIN_EMAIL_PREFIX = 'tickets-admin-e2e-';
let adminEmailSeq = 0;
function uniqueAdminEmail(tag: string): string {
  return `${ADMIN_EMAIL_PREFIX}${tag}-${Date.now()}-${adminEmailSeq++}@smartqoldau.kz`;
}

const DUMMY_ID = '00000000-0000-0000-0000-000000000000';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    lastCode = match ? match[1] : '';
  }
}

// Виртуальные часы (паттерн money-lifecycle.e2e-spec.ts): нужен полный
// контроль над временем, чтобы точно проверить, что второй ответ сотрудника
// НЕ сдвигает firstReplyAt.
const fakeClock = {
  current: new Date('2026-08-21T05:00:00Z'),
  now(): Date {
    return new Date(this.current);
  },
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  },
};

let app: INestApplication;

function get(url: string, token?: string) {
  const req = request(app.getHttpServer()).get(url);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
}
function post(url: string, token?: string) {
  const req = request(app.getHttpServer()).post(url);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
}

describe('Очередь тикетов, ответы и решение сотрудником (E8a, задача 8)', () => {
  let prisma: PrismaService;
  const createdTicketIds: string[] = [];

  async function cleanup() {
    await prisma.auditLog.deleteMany({
      where: { entity: 'ticket', entityId: { in: createdTicketIds } },
    });
    await prisma.ticketMessage.deleteMany({
      where: { ticketId: { in: createdTicketIds } },
    });
    await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    createdTicketIds.length = 0;

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
    await prisma.auditLog.deleteMany({
      where: {
        OR: [{ entityId: { in: userIds } }, { entityId: { in: expertIds } }],
      },
    });
    await prisma.expertTopic.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expert.deleteMany({ where: { id: { in: expertIds } } });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    await prisma.adminUser.deleteMany({
      where: { email: { startsWith: ADMIN_EMAIL_PREFIX } },
    });
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
  });

  beforeEach(async () => {
    fakeClock.current = new Date('2026-08-21T05:00:00Z');
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function loginClient(phone: string) {
    return clientUser(app, phone, () => lastCode);
  }

  // Тикет A: клиент, категория TECHNICAL -> команда SUPPORT_OPERATOR.
  async function ticketA() {
    const client = await loginClient(PH_CLIENT_A);
    const res = await post('/v1/tickets', client.accessToken)
      .send({
        category: 'TECHNICAL',
        subject: 'Не открывается чат',
        body: 'При входе в консультацию чат не загружается.',
      })
      .expect(201);
    createdTicketIds.push(res.body.id);
    return { client, ticketId: res.body.id as string };
  }

  // Тикет B: эксперт, категория PAYOUTS -> команда FINANCE_CONTROL.
  async function ticketB() {
    const expert = await registeredExpertUser(app, PH_EXPERT_B, () => lastCode);
    const res = await post('/v1/tickets', expert.accessToken)
      .send({
        category: 'PAYOUTS',
        subject: 'Не пришла выплата',
        body: 'Заявка на вывод одобрена 3 дня назад, денег нет.',
      })
      .expect(201);
    createdTicketIds.push(res.body.id);
    return { expert, ticketId: res.body.id as string };
  }

  // Тикет C: тот же клиент A, категория SECURITY -> команда QUALITY_TEAM.
  async function ticketC(clientAccessToken: string) {
    const res = await post('/v1/tickets', clientAccessToken)
      .send({
        category: 'SECURITY',
        subject: 'Подозрительный вход',
        body: 'Кто-то пытался зайти в мой аккаунт.',
      })
      .expect(201);
    createdTicketIds.push(res.body.id);
    return { ticketId: res.body.id as string };
  }

  async function staffWithRoles(roles: AdminRole[], tag: string) {
    return adminUser(app, roles, uniqueAdminEmail(tag));
  }

  it('очередь: SUPPORT_OPERATOR видит тикет своей команды, не видит тикет FINANCE_CONTROL; фильтр team чужой команды -> пустой список', async () => {
    const { ticketId: aId } = await ticketA();
    const { ticketId: bId } = await ticketB();
    const support = await staffWithRoles(
      [AdminRole.SUPPORT_OPERATOR],
      'support',
    );

    const list = await get('/v1/admin/tickets', support.token).expect(200);
    const ids = (list.body.items as Array<{ id: string }>).map((t) => t.id);
    expect(ids).toContain(aId);
    expect(ids).not.toContain(bId);
    expect(typeof list.body.total).toBe('number');
    expect(list.body.total).toBeGreaterThanOrEqual(list.body.items.length);

    const foreignFilter = await get(
      '/v1/admin/tickets?team=FINANCE_CONTROL',
      support.token,
    ).expect(200);
    expect(foreignFilter.body).toEqual({ items: [], total: 0 });
  });

  it('суперадмин видит тикеты всех команд без ограничения', async () => {
    const { ticketId: aId } = await ticketA();
    const { ticketId: bId } = await ticketB();
    const superadmin = await staffWithRoles(
      [AdminRole.SUPERADMIN],
      'superadmin',
    );

    const list = await get('/v1/admin/tickets', superadmin.token).expect(200);
    const ids = (list.body.items as Array<{ id: string }>).map((t) => t.id);
    expect(ids).toContain(aId);
    expect(ids).toContain(bId);
    expect(list.body.total).toBeGreaterThanOrEqual(2);
  });

  it('сотрудник с несколькими ролями видит объединение своих команд, но не чужую', async () => {
    const { client, ticketId: aId } = await ticketA();
    const { ticketId: bId } = await ticketB();
    const { ticketId: cId } = await ticketC(client.accessToken);
    const multi = await staffWithRoles(
      [AdminRole.SUPPORT_OPERATOR, AdminRole.FINANCE_CONTROL],
      'multi',
    );

    const all = await get('/v1/admin/tickets', multi.token).expect(200);
    const allIds = (all.body.items as Array<{ id: string }>).map((t) => t.id);
    expect(allIds).toContain(aId);
    expect(allIds).toContain(bId);
    expect(allIds).not.toContain(cId);

    const onlySupport = await get(
      '/v1/admin/tickets?team=SUPPORT_OPERATOR',
      multi.token,
    ).expect(200);
    expect(
      (onlySupport.body.items as Array<{ id: string }>).map((t) => t.id),
    ).toEqual([aId]);
    expect(onlySupport.body.total).toBe(1);

    // QUALITY_TEAM не входит в роли этого сотрудника -> пустой список, не 403.
    const foreignFilter = await get(
      '/v1/admin/tickets?team=QUALITY_TEAM',
      multi.token,
    ).expect(200);
    expect(foreignFilter.body).toEqual({ items: [], total: 0 });
  });

  it('карточка тикета: перепись + данные автора, audit ticket.viewed_by_staff', async () => {
    const { client, ticketId: aId } = await ticketA();
    const support = await staffWithRoles([AdminRole.SUPPORT_OPERATOR], 'view');

    const res = await get(`/v1/admin/tickets/${aId}`, support.token).expect(
      200,
    );
    expect(res.body).toMatchObject({
      id: aId,
      subject: 'Не открывается чат',
      body: 'При входе в консультацию чат не загружается.',
      status: 'NEW',
      team: 'SUPPORT_OPERATOR',
      authorType: 'CLIENT',
      authorUserId: client.userId,
      contactPhone: PH_CLIENT_A,
      messages: [],
    });

    const audit = await prisma.auditLog.findFirst({
      where: {
        entity: 'ticket',
        entityId: aId,
        transition: 'ticket.viewed_by_staff',
      },
    });
    expect(audit?.actorType).toBe('admin');
    expect(audit?.actorId).toBe(support.id);
    expect(audit?.payload).toMatchObject({
      ticketId: aId,
      authorUserId: client.userId,
    });
  });

  it('чужая команда -> 404 TICKET_NOT_FOUND на карточке, ответе и решении; несуществующий тикет -> 404', async () => {
    const { ticketId: bId } = await ticketB();
    const support = await staffWithRoles(
      [AdminRole.SUPPORT_OPERATOR],
      'foreign',
    );

    const detail = await get(`/v1/admin/tickets/${bId}`, support.token).expect(
      404,
    );
    expect(detail.body.error.code).toBe('TICKET_NOT_FOUND');

    const reply = await post(`/v1/admin/tickets/${bId}/reply`, support.token)
      .send({ body: 'Ответ' })
      .expect(404);
    expect(reply.body.error.code).toBe('TICKET_NOT_FOUND');

    const resolve = await post(
      `/v1/admin/tickets/${bId}/resolve`,
      support.token,
    ).expect(404);
    expect(resolve.body.error.code).toBe('TICKET_NOT_FOUND');

    const missing = await get(
      `/v1/admin/tickets/${DUMMY_ID}`,
      support.token,
    ).expect(404);
    expect(missing.body.error.code).toBe('TICKET_NOT_FOUND');
  });

  it('первый ответ проставляет firstReplyAt и переводит NEW -> IN_PROGRESS; второй ответ firstReplyAt не сдвигает; audit ticket.replied', async () => {
    const { ticketId: aId } = await ticketA();
    const support = await staffWithRoles([AdminRole.SUPPORT_OPERATOR], 'reply');

    await post(`/v1/admin/tickets/${aId}/reply`, support.token)
      .send({ body: 'Смотрим, уточните браузер' })
      .expect(200);

    const afterFirst = await prisma.ticket.findUniqueOrThrow({
      where: { id: aId },
    });
    expect(afterFirst.status).toBe('IN_PROGRESS');
    expect(afterFirst.firstReplyAt).not.toBeNull();
    const firstReplyAt = afterFirst.firstReplyAt!.toISOString();

    const auditFirst = await prisma.auditLog.findFirst({
      where: { entity: 'ticket', entityId: aId, transition: 'ticket.replied' },
    });
    expect(auditFirst?.actorType).toBe('admin');
    expect(auditFirst?.actorId).toBe(support.id);

    // Сдвигаем виртуальное время и отвечаем повторно.
    fakeClock.advance(60 * 60 * 1000);
    await post(`/v1/admin/tickets/${aId}/reply`, support.token)
      .send({ body: 'Проверьте, пожалуйста, ещё раз' })
      .expect(200);

    const afterSecond = await prisma.ticket.findUniqueOrThrow({
      where: { id: aId },
    });
    expect(afterSecond.status).toBe('IN_PROGRESS');
    expect(afterSecond.firstReplyAt!.toISOString()).toBe(firstReplyAt);

    const messages = await prisma.ticketMessage.findMany({
      where: { ticketId: aId },
      orderBy: { createdAt: 'asc' },
    });
    expect(messages).toHaveLength(2);
    expect(messages[0].authorKind).toBe('staff');
    expect(messages[0].authorId).toBe(support.id);
  });

  it('автор видит ответ сотрудника в своей карточке', async () => {
    const { client, ticketId: aId } = await ticketA();
    const support = await staffWithRoles([AdminRole.SUPPORT_OPERATOR], 'seen');

    await post(`/v1/admin/tickets/${aId}/reply`, support.token)
      .send({ body: 'Мы уже разбираемся с проблемой' })
      .expect(200);

    const own = await get(`/v1/tickets/${aId}`, client.accessToken).expect(200);
    expect(own.body.messages).toHaveLength(1);
    expect(own.body.messages[0]).toMatchObject({
      authorKind: 'staff',
      body: 'Мы уже разбираемся с проблемой',
    });
  });

  it('resolve -> RESOLVED + resolvedAt, audit ticket.resolved; повторный resolve -> 409; ответ в решённый тикет -> 409', async () => {
    const { ticketId: aId } = await ticketA();
    const support = await staffWithRoles(
      [AdminRole.SUPPORT_OPERATOR],
      'resolve',
    );

    await post(`/v1/admin/tickets/${aId}/resolve`, support.token).expect(200);

    const resolved = await prisma.ticket.findUniqueOrThrow({
      where: { id: aId },
    });
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolvedAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'ticket', entityId: aId, transition: 'ticket.resolved' },
    });
    expect(audit?.actorType).toBe('admin');
    expect(audit?.actorId).toBe(support.id);

    const secondResolve = await post(
      `/v1/admin/tickets/${aId}/resolve`,
      support.token,
    ).expect(409);
    expect(secondResolve.body.error.code).toBe('TICKET_ALREADY_RESOLVED');

    const replyToResolved = await post(
      `/v1/admin/tickets/${aId}/reply`,
      support.token,
    )
      .send({ body: 'Опоздавший ответ' })
      .expect(409);
    expect(replyToResolved.body.error.code).toBe('TICKET_ALREADY_RESOLVED');

    // Ни одно сообщение не должно было добавиться попыткой ответить в
    // решённый тикет.
    const messages = await prisma.ticketMessage.findMany({
      where: { ticketId: aId },
    });
    expect(messages).toHaveLength(0);
  });

  it('без токена -> 401 на всех четырёх маршрутах', async () => {
    await get('/v1/admin/tickets').expect(401);
    await get(`/v1/admin/tickets/${DUMMY_ID}`).expect(401);
    await post(`/v1/admin/tickets/${DUMMY_ID}/reply`)
      .send({ body: 'x' })
      .expect(401);
    await post(`/v1/admin/tickets/${DUMMY_ID}/resolve`).expect(401);
  });

  it('токен клиента (не сотрудника админки) -> 403 ADMIN_FORBIDDEN', async () => {
    const client = await loginClient(PH_CLIENT_A);

    const res = await get('/v1/admin/tickets', client.accessToken).expect(403);
    expect(res.body.error.code).toBe('ADMIN_FORBIDDEN');
  });
});
