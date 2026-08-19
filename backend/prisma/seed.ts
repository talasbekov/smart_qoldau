import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TOPICS: [string, string, string][] = [
  ['anxiety-stress', 'Тревога и стресс', 'Мазасыздық және стресс'],
  ['depression-apathy', 'Депрессия и апатия', 'Депрессия және апатия'],
  ['panic-attacks', 'Панические атаки', 'Дүрбелең шабуылдары'],
  ['addictions', 'Зависимости', 'Тәуелділіктер'],
  ['relationships-family', 'Отношения и семья', 'Қарым-қатынас және отбасы'],
  ['loss-grief', 'Потеря и горе', 'Жоғалту және қайғы'],
  ['self-esteem', 'Самооценка', 'Өзін-өзі бағалау'],
  ['burnout', 'Выгорание', 'Кәсіби шаршау'],
  ['life-crisis', 'Жизненные кризисы', 'Өмірлік дағдарыстар'],
  ['sleep', 'Сон', 'Ұйқы'],
  ['loneliness', 'Одиночество', 'Жалғыздық'],
  ['other', 'Другое', 'Басқа'],
];

async function main() {
  for (const [i, [slug, nameRu, nameKz]] of TOPICS.entries()) {
    await prisma.topic.upsert({
      where: { slug },
      update: { nameRu, nameKz, sortOrder: i },
      create: { slug, nameRu, nameKz, sortOrder: i },
    });
  }
}

main().finally(() => prisma.$disconnect());
