import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ClockService } from '../src/common/clock/clock.service';
import { RetentionSweepService } from '../src/maintenance/retention-sweep.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { clientUser as clientUserHelper } from './utils/client-helpers';

// Ретенция и частичный индекс (E11a, задача 10). Таблицы provider_events и
// notifications растут монотонно: через год работы это гигабайты, которые
// никто не читает.
const PH_U1 = '+77099300001';
const EVENT_PREFIX = 'retention-e2e-';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    if (match) lastCode = match[1];
  }
}

const fakeClock = {
  current: new Date('2026-08-23T05:00:00Z'),
  now() {
    return this.current;
  },
};

describe('Ретенция и индексы (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sweep: RetentionSweepService;
  let userId: string;

  async function cleanup() {
    await prisma.providerEvent.deleteMany({
      where: { providerEventId: { startsWith: EVENT_PREFIX } },
    });
    const users = await prisma.user.findMany({
      where: { phone: PH_U1 },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (ids.length) {
      await prisma.notificationOutbox.deleteMany({
        where: { userId: { in: ids } },
      });
      await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.smsCode.deleteMany({ where: { phone: PH_U1 } });
    await prisma.auditLog.deleteMany({
      where: { entity: 'maintenance', entityId: 'retention' },
    });
  }

  const daysAgo = (days: number) =>
    new Date(fakeClock.current.getTime() - days * 24 * 3600_000);

  async function seedNotification(params: {
    ageDays: number;
    read: boolean;
  }): Promise<string> {
    const row = await prisma.notification.create({
      data: {
        userId,
        type: 'earning.credited',
        title: 'Начисление',
        body: 'Тест ретенции',
        data: {},
        createdAt: daysAgo(params.ageDays),
        readAt: params.read ? daysAgo(params.ageDays) : null,
      },
    });
    return row.id;
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
    sweep = app.get(RetentionSweepService);
    await cleanup();
    const client = await clientUserHelper(app, PH_U1, () => lastCode);
    userId = client.userId;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('прочитанное старое уведомление удаляется, непрочитанное того же возраста — нет', async () => {
    // Человек, не заходивший полгода, не должен потерять запись о
    // начислении: непрочитанные не удаляются НИКОГДА.
    const oldRead = await seedNotification({ ageDays: 120, read: true });
    const oldUnread = await seedNotification({ ageDays: 120, read: false });
    const freshRead = await seedNotification({ ageDays: 10, read: true });

    await sweep.sweep();

    expect(
      await prisma.notification.findUnique({ where: { id: oldRead } }),
    ).toBeNull();
    expect(
      await prisma.notification.findUnique({ where: { id: oldUnread } }),
    ).not.toBeNull();
    expect(
      await prisma.notification.findUnique({ where: { id: freshRead } }),
    ).not.toBeNull();
  });

  it('события провайдера старше срока удаляются, свежие остаются', async () => {
    const old = await prisma.providerEvent.create({
      data: {
        providerEventId: `${EVENT_PREFIX}old`,
        kind: 'payment',
        payload: {},
        createdAt: daysAgo(45),
      },
    });
    const fresh = await prisma.providerEvent.create({
      data: {
        providerEventId: `${EVENT_PREFIX}fresh`,
        kind: 'payment',
        payload: {},
        createdAt: daysAgo(5),
      },
    });

    await sweep.sweep();

    expect(
      await prisma.providerEvent.findUnique({ where: { id: old.id } }),
    ).toBeNull();
    expect(
      await prisma.providerEvent.findUnique({ where: { id: fresh.id } }),
    ).not.toBeNull();
  });

  it('сводка уборки попадает в audit', async () => {
    // Без сводки уборка невидима: её сбой (или наоборот, слишком жадное
    // удаление) никто не заметит.
    await prisma.auditLog.deleteMany({
      where: { entity: 'maintenance', entityId: 'retention' },
    });
    await seedNotification({ ageDays: 200, read: true });

    // Сводка пишется раз в сутки: sweep крутится каждый час, и запись на
    // каждый тик засорила бы журнал. Прокручиваем виртуальные часы на
    // сутки вперёд — так же, как это произойдёт в бою.
    fakeClock.current = new Date(
      fakeClock.current.getTime() + 24 * 3600_000 + 1000,
    );
    await sweep.sweep();

    const summary = await prisma.auditLog.findFirst({
      where: {
        entity: 'maintenance',
        entityId: 'retention',
        transition: 'maintenance.retention_swept',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(summary).not.toBeNull();
    expect(summary!.payload).toMatchObject({
      notifications: expect.any(Number),
      providerEvents: expect.any(Number),
    });
  });

  it('частичный индекс используется запросом sweep-fallback', async () => {
    // Рабочее множество этого запроса — единицы строк, а таблица растёт
    // монотонно: без частичного индекса план уходит в Seq Scan по мере
    // роста notifications.
    const plan = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(
      `EXPLAIN SELECT id FROM notifications
       WHERE sms_fallback_at IS NULL AND push_delivered_at IS NULL
         AND created_at <= NOW()
       ORDER BY created_at LIMIT 100`,
    );
    const text = plan.map((row) => row['QUERY PLAN']).join('\n');
    expect(text).toContain('notifications_pending_fallback_idx');
  });
});
