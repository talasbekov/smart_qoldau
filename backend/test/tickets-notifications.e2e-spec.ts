import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { ClockService } from '../src/common/clock/clock.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { clientUser } from './utils/client-helpers';
import { adminUser } from './utils/admin-helpers';
import { flushPushOutbox } from './utils/outbox-helpers';

// E8a, задача 9: уведомление автору тикета об ответе сотрудника (тип
// ticket.replied, задача 9). Номера +77102xxxxxx свободны (не пересекаются с
// другими спеками — см. grep по test/*.e2e-spec.ts на момент написания).
const PH_CLIENT = '+77102000001';
const ALL_PHONES = [PH_CLIENT];
const GUEST_EMAIL = 'tickets-notifications-e2e-guest@example.com';
const DEVICE_TOKEN = 'tickets-notifications-e2e-device-1';

const ADMIN_EMAIL_PREFIX = 'tickets-notifications-e2e-';
let adminEmailSeq = 0;
function uniqueAdminEmail(tag: string): string {
  return `${ADMIN_EMAIL_PREFIX}${tag}-${Date.now()}-${adminEmailSeq++}@smartqoldau.kz`;
}

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

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

describe('Уведомление автору об ответе поддержки (E8a, задача 9)', () => {
  let prisma: PrismaService;
  let redis: RedisService;
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
    createdTicketIds.length = 0;

    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.notification.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.device.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    await prisma.adminUser.deleteMany({
      where: { email: { startsWith: ADMIN_EMAIL_PREFIX } },
    });

    const keys = await redis.keys(`mockpush:*:${DEVICE_TOKEN}`);
    if (keys.length) await redis.del(...keys);
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
  });

  beforeEach(async () => {
    fakeClock.current = new Date('2026-08-21T05:00:00Z');
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  async function loginClient() {
    return clientUser(app, PH_CLIENT, () => lastCode);
  }

  async function addDevice(accessToken: string) {
    await request(app.getHttpServer())
      .post('/v1/devices')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ platform: 'android', token: DEVICE_TOKEN })
      .expect(201);
  }

  async function pushSentTo(token: string): Promise<any[]> {
    // Пуши уходят из очереди (E11a, задача 3): перед чтением
    // прокручиваем тик — в бою это делает @Interval(1000).
    await flushPushOutbox(app);
    const sent = await redis.lrange(`mockpush:sent:${token}`, 0, -1);
    return sent.map((s) => JSON.parse(s));
  }

  async function staffWithRoles(roles: AdminRole[], tag: string) {
    return adminUser(app, roles, uniqueAdminEmail(tag));
  }

  it('ответ сотрудника -> у автора in-app запись ticket.replied + push; ни текст ответа, ни тема обращения в уведомление не попадают', async () => {
    const client = await loginClient();
    await addDevice(client.accessToken);

    // Узнаваемый маркер темы — тема тикета свободный пользовательский текст
    // без модерации (до 200 символов) и на платформе психологической
    // поддержки может быть чувствительной; она не должна утечь ни в title/
    // body уведомления, ни в его data (data целиком уходит в push-payload —
    // см. NotificationsService.dispatchOrThrow), ни в сам push.
    const subjectMarker = 'МАРКЕР-ТЕМЫ-xyz789-не-приходит-sms-код-при-входе';
    const replyBody =
      'Проверили — код действительно не доставлялся оператором связи, повторно выслан вручную.';

    const created = await post('/v1/tickets', client.accessToken)
      .send({
        category: 'TECHNICAL',
        subject: subjectMarker,
        body: 'Прошу помочь, не могу войти без кода.',
      })
      .expect(201);
    const ticketId = created.body.id as string;
    createdTicketIds.push(ticketId);

    const support = await staffWithRoles(
      [AdminRole.SUPPORT_OPERATOR],
      'support',
    );

    await post(`/v1/admin/tickets/${ticketId}/reply`, support.token)
      .send({ body: replyBody })
      .expect(200);

    await flushPushOutbox(app);

    const stored = await prisma.notification.findFirstOrThrow({
      where: { userId: client.userId, type: 'ticket.replied' },
    });
    expect(stored.title).toBe('Ответ поддержки');
    expect(stored.body).toBe('По вашему обращению есть ответ');
    expect(stored.title).not.toContain(subjectMarker);
    expect(stored.body).not.toContain(subjectMarker);
    expect(stored.body).not.toContain(replyBody);
    expect((stored.data as any).ticketId).toBe(ticketId);
    expect((stored.data as any).subject).toBeUndefined();
    // Полная сериализация data (то, что реально уходит в push-payload по
    // ключам) — маркера темы нет нигде, не только в известных ключах.
    expect(JSON.stringify(stored.data)).not.toContain(subjectMarker);
    expect(stored.pushSentAt).not.toBeNull();

    const sent = await pushSentTo(DEVICE_TOKEN);
    const push = sent.find((s) => s.data?.notificationId === stored.id);
    expect(push).toBeDefined();
    expect(push.title).toBe('Ответ поддержки');
    expect(push.body).toBe('По вашему обращению есть ответ');
    expect(push.body).not.toContain(replyBody);
    // Весь пуш целиком (title/body/data) — маркер темы отсутствует.
    expect(JSON.stringify(push)).not.toContain(subjectMarker);

    // Ответная запись в переписке — реальный текст сотрудника остаётся в
    // приложении (тикет-детали), а не в уведомлении.
    const ticketDetail = await get(
      `/v1/tickets/${ticketId}`,
      client.accessToken,
    ).expect(200);
    expect(
      ticketDetail.body.messages.some((m: any) => m.body === replyBody),
    ).toBe(true);
  });

  it('гостевой тикет: ответ сотрудника не роняет запрос, уведомление не создаётся (нет authorUserId)', async () => {
    const created = await post('/v1/tickets')
      .send({
        category: 'TECHNICAL',
        subject: 'Гостевой вопрос по оплате',
        body: 'Оплатил, но подтверждения нет.',
        contactEmail: GUEST_EMAIL,
      })
      .expect(201);
    const ticketId = created.body.id as string;
    createdTicketIds.push(ticketId);

    const support = await staffWithRoles(
      [AdminRole.SUPPORT_OPERATOR],
      'guest-support',
    );

    await post(`/v1/admin/tickets/${ticketId}/reply`, support.token)
      .send({ body: 'Проверили — оплата прошла, чек отправлен на почту.' })
      .expect(200);

    const afterReply = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
    });
    expect(afterReply.status).toBe('IN_PROGRESS');
    expect(afterReply.firstReplyAt).not.toBeNull();
    expect(afterReply.authorUserId).toBeNull();

    await flushPushOutbox(app);

    const notifications = await prisma.notification.findMany({
      where: { type: 'ticket.replied' },
    });
    const forThisTicket = notifications.filter(
      (n) => (n.data as any)?.ticketId === ticketId,
    );
    expect(forThisTicket).toHaveLength(0);
  });
});
