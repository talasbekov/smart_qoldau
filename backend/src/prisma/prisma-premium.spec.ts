import { PrismaClient } from '@prisma/client';

const s = new PrismaClient();
afterAll(() => s.$disconnect());

it('одна активная подписка на пользователя; период и попытки хранятся', async () => {
  const user = await s.user.create({ data: { phone: '+77070000021' } });
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
