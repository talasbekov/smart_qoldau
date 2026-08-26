import { PrismaClient } from '@prisma/client';

const s = new PrismaClient();
const PHONE = '+77070000021';

afterAll(() => s.$disconnect());

// Уборка ПЕРЕД тестом — по той же причине, что в остальных схемных
// спеках: прерванный прогон оставляет пользователя, и следующий падает
// на уникальном телефоне.
beforeAll(async () => {
  const stale = await s.user.findMany({
    where: { phone: PHONE },
    select: { id: true },
  });
  const ids = stale.map((u) => u.id);
  if (ids.length === 0) return;
  await s.subscription.deleteMany({ where: { userId: { in: ids } } });
  await s.user.deleteMany({ where: { id: { in: ids } } });
});

it('одна активная подписка на пользователя; период и попытки хранятся', async () => {
  const user = await s.user.create({ data: { phone: PHONE } });
  try {
    const sub = await s.subscription.create({
      data: {
        userId: user.id,
        plan: 'MONTH',
        status: 'ACTIVE',
        currentPeriodEnd: new Date('2026-09-26T00:00:00Z'),
        paymentMethodId: 'pm-1',
      },
    });
    expect(sub.renewAttempts).toBe(0);
    expect(sub.firstFailedAt).toBeNull();

    // Вторая ACTIVE тому же пользователю невозможна: частичный уникальный
    // индекс — иначе двойное списание при гонке подписки в двух вкладках.
    await expect(
      s.subscription.create({
        data: {
          userId: user.id,
          plan: 'YEAR',
          status: 'ACTIVE',
          currentPeriodEnd: new Date('2027-08-26T00:00:00Z'),
          paymentMethodId: 'pm-2',
        },
      }),
    ).rejects.toThrow();

    // А истёкшая — можно: история подписок сохраняется.
    await s.subscription.update({
      where: { id: sub.id },
      data: { status: 'EXPIRED' },
    });
    const next = await s.subscription.create({
      data: {
        userId: user.id,
        plan: 'MONTH',
        status: 'ACTIVE',
        currentPeriodEnd: new Date('2026-10-26T00:00:00Z'),
        paymentMethodId: 'pm-1',
      },
    });
    expect(next.id).not.toBe(sub.id);
  } finally {
    await s.subscription.deleteMany({ where: { userId: user.id } });
    await s.user.delete({ where: { id: user.id } });
  }
});
