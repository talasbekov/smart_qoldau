import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AdminRole, TicketStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { clientUser as clientUserHelper } from './utils/client-helpers';
import { adminUser } from './utils/admin-helpers';

// Ответ автора в своём обращении (E11a, задача 8). До этого диалог был
// односторонним: сотрудник отвечал, а автору, чтобы что-то добавить,
// приходилось заводить новое обращение.
const PH_A = '+77099100001';
const PH_B = '+77099100002';
const ALL_PHONES = [PH_A, PH_B];
const SUBJECT_PREFIX = 'reply-author-e2e ';
const ADMIN_EMAIL_PREFIX = 'reply-author-e2e-';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    if (match) lastCode = match[1];
  }
}

describe('Ответ автора в обращении (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;

  async function cleanup() {
    // Сообщения удаляются первыми: FK ticket_messages -> tickets.
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
      where: { phone: { in: ALL_PHONES } },
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
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
    const keys = await redis.keys('admin:*');
    if (keys.length) await redis.del(...keys);
  }

  async function createTicket(accessToken: string, tag: string) {
    const res = await request(app.getHttpServer())
      .post('/v1/tickets')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        category: 'TECHNICAL',
        subject: `${SUBJECT_PREFIX}${tag}`,
        body: 'Приложение закрывается при входе в чат консультации.',
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

  it('автор дописывает в своё обращение, сотрудник видит сообщение', async () => {
    const author = await clientUserHelper(app, PH_A, () => lastCode);
    const ticketId = await createTicket(author.accessToken, 'own');

    await request(app.getHttpServer())
      .post(`/v1/tickets/${ticketId}/reply`)
      .set('Authorization', `Bearer ${author.accessToken}`)
      .send({ body: 'Забыл добавить: воспроизводится только на Android 13.' })
      .expect(204);

    const own = await request(app.getHttpServer())
      .get(`/v1/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${author.accessToken}`)
      .expect(200);
    expect(own.body.messages).toHaveLength(1);
    expect(own.body.messages[0].authorKind).toBe('user');

    const staff = await adminUser(
      app,
      [AdminRole.SUPPORT_OPERATOR],
      `${ADMIN_EMAIL_PREFIX}staff@smartqoldau.kz`,
    );
    const card = await request(app.getHttpServer())
      .get(`/v1/admin/tickets/${ticketId}`)
      .set(...staff.authHeader)
      .expect(200);
    expect(card.body.messages).toHaveLength(1);
  });

  it('в чужое обращение ответить нельзя — 404, а не 403', async () => {
    // Существование чужого тикета не раскрываем.
    const author = await clientUserHelper(app, PH_A, () => lastCode);
    const stranger = await clientUserHelper(app, PH_B, () => lastCode);
    const ticketId = await createTicket(author.accessToken, 'foreign');

    await request(app.getHttpServer())
      .post(`/v1/tickets/${ticketId}/reply`)
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .send({ body: 'Тоже сталкивался с этим.' })
      .expect(404);
  });

  it('в решённое обращение ответить нельзя', async () => {
    const author = await clientUserHelper(app, PH_A, () => lastCode);
    const ticketId = await createTicket(author.accessToken, 'resolved');
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.RESOLVED, resolvedAt: new Date() },
    });

    await request(app.getHttpServer())
      .post(`/v1/tickets/${ticketId}/reply`)
      .set('Authorization', `Bearer ${author.accessToken}`)
      .send({ body: 'Проблема вернулась.' })
      .expect(409);
  });

  it('гостевое обращение автору-гостю недоступно для ответа', async () => {
    // У гостевого тикета нет authorUserId: владельцем он ни для кого не
    // считается, и «ответить» может только зарегистрированный автор.
    const res = await request(app.getHttpServer())
      .post('/v1/tickets')
      .send({
        category: 'TECHNICAL',
        subject: `${SUBJECT_PREFIX}guest`,
        body: 'Не приходит СМС с кодом подтверждения входа.',
        contactPhone: '+77015550000',
      })
      .expect(201);

    const client = await clientUserHelper(app, PH_A, () => lastCode);
    await request(app.getHttpServer())
      .post(`/v1/tickets/${res.body.id}/reply`)
      .set('Authorization', `Bearer ${client.accessToken}`)
      .send({ body: 'Это моё обращение.' })
      .expect(404);
  });

  it('ответ автора не порождает уведомление ему самому', async () => {
    const author = await clientUserHelper(app, PH_A, () => lastCode);
    const ticketId = await createTicket(author.accessToken, 'no-self-notify');

    await request(app.getHttpServer())
      .post(`/v1/tickets/${ticketId}/reply`)
      .set('Authorization', `Bearer ${author.accessToken}`)
      .send({ body: 'Добавлю: началось после обновления.' })
      .expect(204);

    const notifications = await prisma.notification.findMany({
      where: { userId: author.userId, type: 'ticket.replied' },
    });
    expect(notifications).toHaveLength(0);
  });
});
