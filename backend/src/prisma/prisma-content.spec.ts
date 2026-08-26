import { PrismaClient } from '@prisma/client';

const s = new PrismaClient();
afterAll(() => s.$disconnect());

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
  const user = await s.user.create({ data: { phone: '+77070000031' } });
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
