import { PrismaClient } from '@prisma/client';

const s = new PrismaClient();
const PHONE = '+77070000031';

afterAll(() => s.$disconnect());

// Уборка ПЕРЕД тестом: прерванный прогон (таймаут, Ctrl+C) оставляет
// пользователя в dev-БД, и следующий запуск падает на уникальном
// телефоне — один сбой отравляет все последующие.
beforeAll(async () => {
  const stale = await s.user.findMany({
    where: { phone: PHONE },
    select: { id: true },
  });
  const ids = stale.map((u) => u.id);
  if (ids.length === 0) return;
  await s.contentVote.deleteMany({ where: { userId: { in: ids } } });
  await s.contentProgress.deleteMany({ where: { userId: { in: ids } } });
  await s.user.deleteMany({ where: { id: { in: ids } } });
});

it('материал, прогресс и один голос на пользователя', async () => {
  const item = await s.contentItem.create({
    data: {
      kind: 'ARTICLE',
      access: 'FREE',
      slug: `test-article-${Date.now()}`,
      category: 'anxiety',
      titleRu: 'Тест',
      titleKk: 'Тест',
      summaryRu: 'Кратко',
      summaryKk: 'Қысқаша',
      payload: { markdownRu: '# Привет', markdownKk: '# Сәлем' },
      sortOrder: 10,
    },
  });
  const user = await s.user.create({ data: { phone: PHONE } });
  try {
    // Прогресс уникален по (user, item): повторное чтение обновляет
    // позицию, а не плодит строки — иначе «сколько прочитано» перестаёт
    // быть однозначным.
    await s.contentProgress.create({
      data: { userId: user.id, itemId: item.id, positionPermille: 500 },
    });
    await expect(
      s.contentProgress.create({
        data: { userId: user.id, itemId: item.id, positionPermille: 900 },
      }),
    ).rejects.toThrow();

    await s.contentVote.create({
      data: { userId: user.id, itemId: item.id, useful: true },
    });
    await expect(
      s.contentVote.create({
        data: { userId: user.id, itemId: item.id, useful: false },
      }),
    ).rejects.toThrow();
  } finally {
    await s.contentVote.deleteMany({ where: { userId: user.id } });
    await s.contentProgress.deleteMany({ where: { userId: user.id } });
    await s.user.delete({ where: { id: user.id } });
    await s.contentItem.delete({ where: { id: item.id } });
  }
});
