import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

describe('Prisma Notifications schema', () => {
  const s = new PrismaService();
  beforeAll(() => s.$connect());
  afterAll(() => s.$disconnect());

  const phones = ['+77070000015', '+77070000016'];

  // Уборка ПЕРЕД тестом, а не только после. try/finally в теле спасает от
  // падения assert'а, но не от прерванного прогона: убитый по таймауту
  // тест оставляет пользователей в dev-БД, и следующий запуск падает на
  // уникальном телефоне — то есть один сбой отравляет все последующие.
  beforeAll(async () => {
    const stale = await s.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true },
    });
    const ids = stale.map((u) => u.id);
    if (ids.length === 0) return;
    await s.notification.deleteMany({ where: { userId: { in: ids } } });
    await s.device.deleteMany({ where: { userId: { in: ids } } });
    await s.user.deleteMany({ where: { id: { in: ids } } });
  });

  it('Device уникален по token (перепривязка через upsert, не дубль); Notification хранит data и читается по userId; User.locale по умолчанию ru', async () => {
    const user = await s.user.create({ data: { phone: '+77070000015' } });
    const other = await s.user.create({ data: { phone: '+77070000016' } });

    // try/finally: падение любого assert/шага ниже не должно оставлять
    // осиротевший user/device/notification в dev-БД (PrismaService тут —
    // не тестовая 5433, а обычная dev-БД на 5432; раньше cleanup был только
    // в хвосте тела it и не выполнялся при падении в середине).
    try {
      expect(user.locale).toBe('ru');

      await s.device.create({
        data: {
          userId: user.id,
          platform: 'android',
          token: 'fcm-token-uniq-1',
          locale: 'ru',
        },
      });

      await expect(
        s.device.create({
          data: {
            userId: other.id,
            platform: 'ios',
            token: 'fcm-token-uniq-1',
            locale: 'kz',
          },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });

      const n1 = await s.notification.create({
        data: {
          userId: user.id,
          type: 'earning.credited',
          title: 'Начисление',
          body: 'Вам начислено 12 750 ₸',
          data: { amountTiyn: 1275000 } as Prisma.InputJsonValue,
        },
      });
      await s.notification.create({
        data: {
          userId: other.id,
          type: 'offer.incoming',
          title: 'Новая заявка',
          body: 'Откройте приложение',
          data: {} as Prisma.InputJsonValue,
        },
      });

      const mine = await s.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      });
      expect(mine).toHaveLength(1);
      expect(mine[0].id).toBe(n1.id);
      expect((mine[0].data as { amountTiyn: number }).amountTiyn).toBe(1275000);
      expect(mine[0].readAt).toBeNull();
      expect(mine[0].pushSentAt).toBeNull();
    } finally {
      await s.notification.deleteMany({
        where: { userId: { in: [user.id, other.id] } },
      });
      await s.device.deleteMany({
        where: { userId: { in: [user.id, other.id] } },
      });
      await s.user.deleteMany({ where: { id: { in: [user.id, other.id] } } });
    }
  });
});
