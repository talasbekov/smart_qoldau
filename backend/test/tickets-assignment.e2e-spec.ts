import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { clientUser as clientUserHelper } from './utils/client-helpers';
import { adminUser } from './utils/admin-helpers';

// Назначение обращения сотруднику (E11a, задача 8). До этого очередь была
// общей, и двое операторов отвечали в один тикет, не зная друг о друге.
const PH_A = '+77099200001';
const SUBJECT_PREFIX = 'assignment-e2e ';
const ADMIN_EMAIL_PREFIX = 'assignment-e2e-';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    if (match) lastCode = match[1];
  }
}

describe('Назначение обращения сотруднику (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  async function cleanup() {
    await prisma.ticketMessage.deleteMany({
      where: { ticket: { subject: { startsWith: SUBJECT_PREFIX } } },
    });
    await prisma.ticket.deleteMany({
      where: { subject: { startsWith: SUBJECT_PREFIX } },
    });
    await prisma.adminUser.deleteMany({
      where: { email: { startsWith: ADMIN_EMAIL_PREFIX } },
    });
    const users = await prisma.user.findMany({
      where: { phone: PH_A },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (ids.length) {
      await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
      await prisma.notificationOutbox.deleteMany({
        where: { userId: { in: ids } },
      });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.smsCode.deleteMany({ where: { phone: PH_A } });
    const keys = await redis.keys('admin:*');
    if (keys.length) await redis.del(...keys);
  }

  let seq = 0;
  const staffEmail = (tag: string) =>
    `${ADMIN_EMAIL_PREFIX}${tag}-${seq++}@smartqoldau.kz`;

  async function createTicket(tag: string) {
    const client = await clientUserHelper(app, PH_A, () => lastCode);
    const res = await request(app.getHttpServer())
      .post('/v1/tickets')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({
        category: 'TECHNICAL',
        subject: `${SUBJECT_PREFIX}${tag}`,
        body: 'Видеозвонок обрывается через минуту после начала.',
      })
      .expect(201);
    return res.body.id as string;
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    redis = app.get(RedisService);
    await cleanup();
  });

  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('сотрудник берёт тикет себе и снимает назначение', async () => {
    const ticketId = await createTicket('self');
    const staff = await adminUser(
      app,
      [AdminRole.SUPPORT_OPERATOR],
      staffEmail('self'),
    );

    await request(app.getHttpServer())
      .post(`/v1/admin/tickets/${ticketId}/assign`)
      .set(...staff.authHeader)
      .send({})
      .expect(204);

    const mine = await request(app.getHttpServer())
      .get('/v1/admin/tickets?assigned=me')
      .set(...staff.authHeader)
      .expect(200);
    expect(mine.body.items.map((t: { id: string }) => t.id)).toContain(
      ticketId,
    );

    await request(app.getHttpServer())
      .post(`/v1/admin/tickets/${ticketId}/assign`)
      .set(...staff.authHeader)
      .send({ adminUserId: null })
      .expect(204);

    const free = await request(app.getHttpServer())
      .get('/v1/admin/tickets?assigned=none')
      .set(...staff.authHeader)
      .expect(200);
    expect(free.body.items.map((t: { id: string }) => t.id)).toContain(
      ticketId,
    );
  });

  it('назначение коллеге по команде проходит, чужой команде — 400', async () => {
    // Тикет, отданный в чужую команду, исчезает из обеих очередей.
    const ticketId = await createTicket('colleague');
    const staff = await adminUser(
      app,
      [AdminRole.SUPPORT_OPERATOR],
      staffEmail('owner'),
    );
    const colleague = await adminUser(
      app,
      [AdminRole.SUPPORT_OPERATOR],
      staffEmail('colleague'),
    );
    const foreign = await adminUser(
      app,
      [AdminRole.FINANCE_CONTROL],
      staffEmail('foreign'),
    );

    await request(app.getHttpServer())
      .post(`/v1/admin/tickets/${ticketId}/assign`)
      .set(...staff.authHeader)
      .send({ adminUserId: colleague.id })
      .expect(204);

    const res = await request(app.getHttpServer())
      .post(`/v1/admin/tickets/${ticketId}/assign`)
      .set(...staff.authHeader)
      .send({ adminUserId: foreign.id })
      .expect(400);
    expect(res.body.error.code).toBe('TICKET_ASSIGNEE_INVALID');
  });

  it('первый ответ сотрудника назначает тикет ему автоматически', async () => {
    // Самый частый сценарий не должен требовать лишнего действия.
    const ticketId = await createTicket('auto');
    const staff = await adminUser(
      app,
      [AdminRole.SUPPORT_OPERATOR],
      staffEmail('auto'),
    );

    await request(app.getHttpServer())
      .post(`/v1/admin/tickets/${ticketId}/reply`)
      .set(...staff.authHeader)
      .send({ body: 'Проверяем, спасибо за обращение.' })
      .expect(200);

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
    });
    expect(ticket.assignedToId).toBe(staff.id);
  });

  it('ответ второго сотрудника не перехватывает уже назначенный тикет', async () => {
    const ticketId = await createTicket('no-steal');
    const first = await adminUser(
      app,
      [AdminRole.SUPPORT_OPERATOR],
      staffEmail('first'),
    );
    const second = await adminUser(
      app,
      [AdminRole.SUPPORT_OPERATOR],
      staffEmail('second'),
    );

    await request(app.getHttpServer())
      .post(`/v1/admin/tickets/${ticketId}/reply`)
      .set(...first.authHeader)
      .send({ body: 'Взял в работу.' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/admin/tickets/${ticketId}/reply`)
      .set(...second.authHeader)
      .send({ body: 'Дополню коллегу.' })
      .expect(200);

    const ticket = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
    });
    expect(ticket.assignedToId).toBe(first.id);
  });

  it('фильтр assigned=me не показывает чужие тикеты', async () => {
    const mineId = await createTicket('mine');
    const othersId = await createTicket('others');
    const me = await adminUser(
      app,
      [AdminRole.SUPPORT_OPERATOR],
      staffEmail('me'),
    );
    const other = await adminUser(
      app,
      [AdminRole.SUPPORT_OPERATOR],
      staffEmail('other'),
    );

    await request(app.getHttpServer())
      .post(`/v1/admin/tickets/${mineId}/assign`)
      .set(...me.authHeader)
      .send({})
      .expect(204);
    await request(app.getHttpServer())
      .post(`/v1/admin/tickets/${othersId}/assign`)
      .set(...other.authHeader)
      .send({})
      .expect(204);

    const mine = await request(app.getHttpServer())
      .get('/v1/admin/tickets?assigned=me')
      .set(...me.authHeader)
      .expect(200);
    const ids = mine.body.items.map((t: { id: string }) => t.id);
    expect(ids).toContain(mineId);
    expect(ids).not.toContain(othersId);
  });
});
