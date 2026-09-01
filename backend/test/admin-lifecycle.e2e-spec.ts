import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AdminRole, TicketCategory, TicketTeam } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClockService } from '../src/common/clock/clock.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { adminUser } from './utils/admin-helpers';
import { registeredExpertUser } from './utils/expert-helpers';
import { clientUser } from './utils/client-helpers';

// Сквозной e2e эпика E8a (задача 10): роли сотрудников админки + тикеты
// поддержки в одном приложении, от входа суперадмина до попытки клиента
// пробиться в админку своим JWT. Номера +77104xxxxxx свободны (не
// пересекаются с другими спеками — см. grep по test/*.e2e-spec.ts на момент
// написания).
const PH_CLIENT = '+77104000001';
const PH_EXPERT = '+77104000002';
const ALL_PHONES = [PH_CLIENT, PH_EXPERT];

const ADMIN_EMAIL_PREFIX = 'admin-lifecycle-e2e-';
let adminEmailSeq = 0;
function uniqueAdminEmail(tag: string): string {
  return `${ADMIN_EMAIL_PREFIX}${tag}-${Date.now()}-${adminEmailSeq++}@smartqoldau.kz`;
}
const STAFF_PASSWORD = 'admin-lifecycle-e2e-staff-password-1';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    lastCode = match ? match[1] : '';
  }
}

// Виртуальные часы (паттерн E8a/E9): часы двигаются между шагами сценария,
// чтобы разграничить момент создания тикета и момент ответа сотрудника.
const fakeClock = {
  current: new Date('2026-08-22T05:00:00Z'),
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

describe('Сквозной e2e ролей админки и тикетов поддержки (E8a, задача 10)', () => {
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

    await prisma.notification.deleteMany({
      where: { userId: { in: userIds } },
    });
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
    fakeClock.current = new Date('2026-08-22T05:00:00Z');
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('суперадмин заводит сотрудников -> клиент и эксперт открывают тикеты в разных командах -> ответ и решение -> чужой JWT отклонён', async () => {
    // --- 1. Суперадмин НЕ из сида: строка admin_users создана хелпером и ---
    // залогинена настоящим POST /v1/admin/auth/login (см. adminUser()).
    const superadmin = await adminUser(
      app,
      [AdminRole.SUPERADMIN],
      uniqueAdminEmail('superadmin'),
    );

    // --- 2. Суперадмин создаёт оператора поддержки и финконтроль -----------
    const supportEmail = uniqueAdminEmail('support');
    const supportCreated = await post('/v1/admin/staff', superadmin.token)
      .send({
        email: supportEmail,
        password: STAFF_PASSWORD,
        roles: [AdminRole.SUPPORT_OPERATOR],
      })
      .expect(201);
    expect(supportCreated.body.roles).toEqual([AdminRole.SUPPORT_OPERATOR]);

    const financeEmail = uniqueAdminEmail('finance');
    const financeCreated = await post('/v1/admin/staff', superadmin.token)
      .send({
        email: financeEmail,
        password: STAFF_PASSWORD,
        roles: [AdminRole.FINANCE_CONTROL],
      })
      .expect(201);
    expect(financeCreated.body.roles).toEqual([AdminRole.FINANCE_CONTROL]);

    // Оба входят выданными паролями (не хелпером — настоящий вход по
    // email+паролю, как задумано задачей 6/2).
    const supportLogin = await post('/v1/admin/auth/login')
      .send({
        email: supportEmail,
        password: STAFF_PASSWORD,
      })
      .expect(200);
    const supportToken = supportLogin.body.accessToken as string;
    expect(supportLogin.body.admin.roles).toEqual([AdminRole.SUPPORT_OPERATOR]);

    const financeLogin = await post('/v1/admin/auth/login')
      .send({
        email: financeEmail,
        password: STAFF_PASSWORD,
      })
      .expect(200);
    const financeToken = financeLogin.body.accessToken as string;
    expect(financeLogin.body.admin.roles).toEqual([AdminRole.FINANCE_CONTROL]);

    // --- 3. Клиент открывает тикет категории PAYMENT ------------------------
    const client = await clientUser(app, PH_CLIENT, () => lastCode);
    const paymentTicket = await post('/v1/tickets', client.accessToken)
      .send({
        category: TicketCategory.PAYMENT,
        subject: 'Списали дважды за одну консультацию',
        body: 'Оплатил консультацию, в выписке два одинаковых списания.',
      })
      .expect(201);
    const paymentTicketId = paymentTicket.body.id as string;
    createdTicketIds.push(paymentTicketId);
    expect(paymentTicket.body).toMatchObject({
      status: 'NEW',
      category: TicketCategory.PAYMENT,
      team: TicketTeam.SUPPORT_OPERATOR,
    });

    // Тикет попал в очередь поддержки...
    const supportQueue = await get('/v1/admin/tickets', supportToken).expect(
      200,
    );
    expect(
      (supportQueue.body.items as Array<{ id: string }>).map((t) => t.id),
    ).toContain(paymentTicketId);

    // ...а финконтроль его не видит (своя команда FINANCE_CONTROL не
    // пересекается с SUPPORT_OPERATOR — дефолтный список фильтруется по
    // собственным командам сотрудника).
    const financeQueueBefore = await get(
      '/v1/admin/tickets',
      financeToken,
    ).expect(200);
    expect(
      (financeQueueBefore.body.items as Array<{ id: string }>).map((t) => t.id),
    ).not.toContain(paymentTicketId);

    // --- 4. Оператор поддержки отвечает -------------------------------------
    fakeClock.advance(5 * 60 * 1000);
    await post(`/v1/admin/tickets/${paymentTicketId}/reply`, supportToken)
      .send({ body: 'Разбираемся, вернём лишнее списание в течение суток.' })
      .expect(200);

    const afterReply = await get(
      `/v1/tickets/${paymentTicketId}`,
      client.accessToken,
    ).expect(200);
    expect(afterReply.body.status).toBe('IN_PROGRESS');
    expect(afterReply.body.firstReplyAt).not.toBeNull();
    expect(afterReply.body.messages).toHaveLength(1);
    expect(afterReply.body.messages[0]).toMatchObject({ authorKind: 'staff' });

    // У клиента появилась in-app запись уведомления.
    const clientNotifications = await get(
      '/v1/notifications',
      client.accessToken,
    ).expect(200);
    const replyNotification = clientNotifications.body.items.find(
      (n: any) =>
        n.type === 'ticket.replied' &&
        (n.data as any)?.ticketId === paymentTicketId,
    );
    expect(replyNotification).toBeDefined();
    expect(replyNotification.readAt).toBeNull();

    // --- 5. Оператор решает тикет -------------------------------------------
    fakeClock.advance(10 * 60 * 1000);
    await post(
      `/v1/admin/tickets/${paymentTicketId}/resolve`,
      supportToken,
    ).expect(200);

    const afterResolve = await get(
      `/v1/tickets/${paymentTicketId}`,
      client.accessToken,
    ).expect(200);
    expect(afterResolve.body.status).toBe('RESOLVED');
    expect(afterResolve.body.messages).toHaveLength(1);
    expect(afterResolve.body.messages[0].body).toBe(
      'Разбираемся, вернём лишнее списание в течение суток.',
    );

    // --- 6. Эксперт открывает тикет категории PAYOUTS -----------------------
    const expert = await registeredExpertUser(app, PH_EXPERT, () => lastCode);
    const payoutTicket = await post('/v1/tickets', expert.accessToken)
      .send({
        category: TicketCategory.PAYOUTS,
        subject: 'Выплата не пришла',
        body: 'Заявка на вывод одобрена, денег на карте нет уже 2 дня.',
      })
      .expect(201);
    const payoutTicketId = payoutTicket.body.id as string;
    createdTicketIds.push(payoutTicketId);
    expect(payoutTicket.body.team).toBe(TicketTeam.FINANCE_CONTROL);

    // В очереди финконтроля...
    const financeQueueAfter = await get(
      '/v1/admin/tickets',
      financeToken,
    ).expect(200);
    expect(
      (financeQueueAfter.body.items as Array<{ id: string }>).map((t) => t.id),
    ).toContain(payoutTicketId);

    // ...поддержка его не видит.
    const supportQueueAfter = await get(
      '/v1/admin/tickets',
      supportToken,
    ).expect(200);
    expect(
      (supportQueueAfter.body.items as Array<{ id: string }>).map((t) => t.id),
    ).not.toContain(payoutTicketId);

    // --- 7. Пользовательский JWT в админку -> 403 ADMIN_FORBIDDEN ----------
    const forbiddenTickets = await get(
      '/v1/admin/tickets',
      client.accessToken,
    ).expect(403);
    expect(forbiddenTickets.body.error.code).toBe('ADMIN_FORBIDDEN');

    const forbiddenStaff = await get(
      '/v1/admin/staff',
      expert.accessToken,
    ).expect(403);
    expect(forbiddenStaff.body.error.code).toBe('ADMIN_FORBIDDEN');
  });
});
