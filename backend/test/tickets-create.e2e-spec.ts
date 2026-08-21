import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { registeredExpertUser } from './utils/expert-helpers';
import { clientUser } from './utils/client-helpers';

// Номера спека задачи 7 (E8a): модель тикетов и создание обращения. Диапазон
// +77088xxxxxx свободен (не пересекается с другими спеками — см. grep по
// test/*.e2e-spec.ts на момент написания).
const PH_CLIENT_A = '+77088000001';
const PH_CLIENT_B = '+77088000002';
const PH_EXPERT_A = '+77088000003';
const ALL_PHONES = [PH_CLIENT_A, PH_CLIENT_B, PH_EXPERT_A];

const GUEST_EMAIL = 'guest-ticket-e2e-task7@example.com';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

let app: INestApplication;

function post(url: string, token?: string) {
  const req = request(app.getHttpServer()).post(url);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
}
function get(url: string, token?: string) {
  const req = request(app.getHttpServer()).get(url);
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
}

describe('Создание обращения в поддержку (E8a, задача 7)', () => {
  let prisma: PrismaService;
  const createdTicketIds: string[] = [];

  async function cleanup() {
    await prisma.auditLog.deleteMany({
      where: { entity: 'ticket', entityId: { in: createdTicketIds } },
    });
    await prisma.ticketMessage.deleteMany({
      where: { ticketId: { in: createdTicketIds } },
    });
    await prisma.ticket.deleteMany({
      where: {
        OR: [{ id: { in: createdTicketIds } }, { contactEmail: GUEST_EMAIL }],
      },
    });

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
    createdTicketIds.length = 0;
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
  });

  beforeEach(() => cleanup());

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function loginClient(phone: string) {
    return clientUser(app, phone, () => lastCode);
  }

  it('клиент создаёт тикет -> запись с authorType CLIENT и team SUPPORT_OPERATOR (категория TECHNICAL)', async () => {
    const client = await loginClient(PH_CLIENT_A);

    const res = await post('/v1/tickets', client.accessToken)
      .send({
        category: 'TECHNICAL',
        subject: 'Не открывается чат',
        body: 'При входе в консультацию чат не загружается.',
      })
      .expect(201);
    createdTicketIds.push(res.body.id);

    expect(res.body).toEqual({
      id: expect.any(String),
      status: 'NEW',
      category: 'TECHNICAL',
      team: 'SUPPORT_OPERATOR',
      createdAt: expect.any(String),
    });

    const stored = await prisma.ticket.findUniqueOrThrow({
      where: { id: res.body.id },
    });
    expect(stored.authorType).toBe('CLIENT');
    expect(stored.authorUserId).toBe(client.userId);
    expect(stored.contactPhone).toBe(PH_CLIENT_A);
    expect(stored.contactEmail).toBeNull();
    expect(stored.team).toBe('SUPPORT_OPERATOR');

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'ticket', entityId: res.body.id },
    });
    expect(audit?.transition).toBe('ticket.created');
    expect(audit?.actorType).toBe('user');
    expect(audit?.actorId).toBe(client.userId);
  });

  it('эксперт создаёт тикет категории PAYOUTS -> команда FINANCE_CONTROL, authorType EXPERT', async () => {
    const expert = await registeredExpertUser(app, PH_EXPERT_A, () => lastCode);

    const res = await post('/v1/tickets', expert.accessToken)
      .send({
        category: 'PAYOUTS',
        subject: 'Не пришла выплата',
        body: 'Заявка на вывод одобрена 3 дня назад, денег нет.',
      })
      .expect(201);
    createdTicketIds.push(res.body.id);

    expect(res.body.team).toBe('FINANCE_CONTROL');
    expect(res.body.category).toBe('PAYOUTS');

    const stored = await prisma.ticket.findUniqueOrThrow({
      where: { id: res.body.id },
    });
    expect(stored.authorType).toBe('EXPERT');
  });

  it('гость без контакта -> 400 TICKET_CONTACT_REQUIRED', async () => {
    const res = await post('/v1/tickets')
      .send({
        category: 'OTHER',
        subject: 'Вопрос по регистрации',
        body: 'Как создать аккаунт без телефона?',
      })
      .expect(400);
    expect(res.body.error.code).toBe('TICKET_CONTACT_REQUIRED');

    const found = await prisma.ticket.findFirst({
      where: { contactEmail: GUEST_EMAIL },
    });
    expect(found).toBeNull();
  });

  it('гость с email -> тикет создан, authorType GUEST', async () => {
    const res = await post('/v1/tickets')
      .send({
        category: 'OTHER',
        subject: 'Вопрос по регистрации',
        body: 'Как создать аккаунт без телефона?',
        contactEmail: GUEST_EMAIL,
      })
      .expect(201);
    createdTicketIds.push(res.body.id);

    expect(res.body.status).toBe('NEW');
    expect(res.body.team).toBe('SUPPORT_OPERATOR');

    const stored = await prisma.ticket.findUniqueOrThrow({
      where: { id: res.body.id },
    });
    expect(stored.authorType).toBe('GUEST');
    expect(stored.authorUserId).toBeNull();
    expect(stored.contactEmail).toBe(GUEST_EMAIL);

    const audit = await prisma.auditLog.findFirst({
      where: { entity: 'ticket', entityId: res.body.id },
    });
    expect(audit?.actorType).toBe('system');
    expect(audit?.actorId).toBeNull();
  });

  it('клиент с категорией VERIFICATION -> 400 TICKET_CATEGORY_NOT_ALLOWED', async () => {
    const client = await loginClient(PH_CLIENT_A);

    const res = await post('/v1/tickets', client.accessToken)
      .send({
        category: 'VERIFICATION',
        subject: 'Верификация',
        body: 'Хочу пройти верификацию эксперта',
      })
      .expect(400);
    expect(res.body.error.code).toBe('TICKET_CATEGORY_NOT_ALLOWED');
  });

  it('свой список — только свои тикеты, вторичная сортировка по id, чужой id -> 404', async () => {
    const clientA = await loginClient(PH_CLIENT_A);
    const clientB = await loginClient(PH_CLIENT_B);

    const t1 = await post('/v1/tickets', clientA.accessToken)
      .send({ category: 'TECHNICAL', subject: 'A1', body: 'body A1' })
      .expect(201);
    createdTicketIds.push(t1.body.id);
    const t2 = await post('/v1/tickets', clientA.accessToken)
      .send({ category: 'PAYMENT', subject: 'A2', body: 'body A2' })
      .expect(201);
    createdTicketIds.push(t2.body.id);
    const tB = await post('/v1/tickets', clientB.accessToken)
      .send({ category: 'OTHER', subject: 'B1', body: 'body B1' })
      .expect(201);
    createdTicketIds.push(tB.body.id);

    const list = await get('/v1/tickets', clientA.accessToken).expect(200);
    const ids = (list.body as Array<{ id: string }>).map((t) => t.id);
    expect(ids).toContain(t1.body.id);
    expect(ids).toContain(t2.body.id);
    expect(ids).not.toContain(tB.body.id);

    // Своё обращение — 200 с перепиской (пустой на момент создания).
    const own = await get(
      `/v1/tickets/${t1.body.id}`,
      clientA.accessToken,
    ).expect(200);
    expect(own.body).toMatchObject({
      id: t1.body.id,
      subject: 'A1',
      body: 'body A1',
      category: 'TECHNICAL',
      status: 'NEW',
      messages: [],
    });

    // Чужое обращение -> 404 TICKET_NOT_FOUND (не 403 — не раскрываем
    // существование).
    const foreign = await get(
      `/v1/tickets/${tB.body.id}`,
      clientA.accessToken,
    ).expect(404);
    expect(foreign.body.error.code).toBe('TICKET_NOT_FOUND');
  });

  it('GET /v1/tickets и /v1/tickets/:id без токена -> 401', async () => {
    await get('/v1/tickets').expect(401);
    await get('/v1/tickets/00000000-0000-0000-0000-000000000000').expect(401);
  });
});
