import { Prisma, PrismaClient } from '@prisma/client';

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

// Демо-материалы библиотеки самопомощи (E13). Без них раздел невозможно ни
// показать, ни проверить руками: пустой экран одинаково выглядит и когда
// всё работает, и когда сломано. Аудиофайлы в бакет НЕ кладутся — ключи
// указывают на то, что зальёт редактор; до заливки плеер честно ответит
// ошибкой хранилища, а не притворится, что материала нет.
const CONTENT: {
  kind: 'MEDITATION' | 'MUSIC' | 'ARTICLE' | 'BREATHING';
  access: 'FREE' | 'PREMIUM';
  slug: string;
  category: string;
  titleRu: string;
  titleKk: string;
  summaryRu: string;
  summaryKk: string;
  payload: Prisma.InputJsonValue;
  durationSec?: number;
}[] = [
  {
    kind: 'BREATHING',
    access: 'FREE',
    slug: 'box-breathing',
    category: 'anxiety-stress',
    titleRu: 'Квадратное дыхание',
    titleKk: 'Шаршы тыныс алу',
    summaryRu: 'Четыре фазы по четыре секунды — помогает собраться',
    summaryKk: 'Төрт фаза, әрқайсысы төрт секунд — жинақталуға көмектеседі',
    durationSec: 320,
    payload: {
      cycles: 5,
      phases: [
        { nameRu: 'Вдох', nameKk: 'Дем алу', seconds: 4 },
        { nameRu: 'Задержка', nameKk: 'Ұстау', seconds: 4 },
        { nameRu: 'Выдох', nameKk: 'Дем шығару', seconds: 4 },
        { nameRu: 'Пауза', nameKk: 'Үзіліс', seconds: 4 },
      ],
    },
  },
  {
    kind: 'BREATHING',
    access: 'FREE',
    slug: 'breathing-4-7-8',
    category: 'sleep',
    titleRu: 'Дыхание 4–7–8',
    titleKk: '4–7–8 тыныс алу',
    summaryRu: 'Длинный выдох перед сном',
    summaryKk: 'Ұйқы алдындағы ұзақ дем шығару',
    durationSec: 285,
    payload: {
      cycles: 6,
      phases: [
        { nameRu: 'Вдох', nameKk: 'Дем алу', seconds: 4 },
        { nameRu: 'Задержка', nameKk: 'Ұстау', seconds: 7 },
        { nameRu: 'Выдох', nameKk: 'Дем шығару', seconds: 8 },
      ],
    },
  },
  {
    kind: 'ARTICLE',
    access: 'FREE',
    slug: 'what-is-anxiety',
    category: 'anxiety-stress',
    titleRu: 'Что такое тревога и зачем она нужна',
    titleKk: 'Мазасыздық дегеніміз не және ол не үшін керек',
    summaryRu:
      'Коротко о механизме тревоги и о том, когда стоит обратиться к специалисту',
    summaryKk:
      'Мазасыздық механизмі туралы қысқаша және маманға қашан жүгіну керектігі',
    durationSec: 300,
    payload: {
      markdownRu:
        '## Тревога — это не поломка\n\nТревога — реакция организма на неопределённость. ' +
        'Она мобилизует: учащается пульс, обостряется внимание.\n\n' +
        '## Когда стоит обратиться к специалисту\n\n' +
        'Если тревога держится неделями, мешает спать, работать и общаться — это повод ' +
        'поговорить с психологом. Материалы этого раздела не заменяют консультацию и не ' +
        'являются медицинской помощью.',
      markdownKk:
        '## Мазасыздық — бұл ақау емес\n\nМазасыздық — белгісіздікке организмнің жауабы.\n\n' +
        '## Маманға қашан жүгіну керек\n\n' +
        'Егер мазасыздық апталап сақталса, ұйқыға, жұмысқа кедергі келтірсе — психологпен ' +
        'сөйлескен жөн. Бұл бөлімнің материалдары консультацияны алмастырмайды.',
    },
  },
  {
    kind: 'ARTICLE',
    access: 'PREMIUM',
    slug: 'sleep-hygiene',
    category: 'sleep',
    titleRu: 'Гигиена сна: что действительно работает',
    titleKk: 'Ұйқы гигиенасы: шынымен не жұмыс істейді',
    summaryRu: 'Разбор привычек, которые влияют на сон',
    summaryKk: 'Ұйқыға әсер ететін әдеттерді талдау',
    durationSec: 420,
    payload: {
      markdownRu:
        '## Режим важнее длительности\n\nЛожиться и вставать в одно время полезнее, ' +
        'чем «отсыпаться» на выходных.',
      markdownKk:
        '## Режим ұзақтықтан маңызды\n\nБір уақытта жату және тұру пайдалырақ.',
    },
  },
  {
    kind: 'MEDITATION',
    access: 'FREE',
    slug: 'five-minute-grounding',
    category: 'anxiety-stress',
    titleRu: 'Заземление за пять минут',
    titleKk: 'Бес минутта жерге бекіну',
    summaryRu: 'Короткая практика возвращения в тело',
    summaryKk: 'Денеге оралудың қысқа тәжірибесі',
    durationSec: 300,
    payload: { audioKey: 'meditations/five-minute-grounding.mp3' },
  },
  {
    kind: 'MEDITATION',
    access: 'PREMIUM',
    slug: 'deep-sleep',
    category: 'sleep',
    titleRu: 'Глубокий сон',
    titleKk: 'Терең ұйқы',
    summaryRu: 'Двадцать минут для засыпания',
    summaryKk: 'Ұйықтап кетуге жиырма минут',
    durationSec: 1200,
    payload: { audioKey: 'meditations/deep-sleep.mp3' },
  },
  {
    kind: 'MUSIC',
    access: 'FREE',
    slug: 'rain-and-thunder',
    category: 'sleep',
    titleRu: 'Дождь и гроза',
    titleKk: 'Жаңбыр мен найзағай',
    summaryRu: 'Фоновый звук на час',
    summaryKk: 'Бір сағаттық фондық дыбыс',
    durationSec: 3600,
    payload: { audioKey: 'music/rain-and-thunder.mp3' },
  },
  {
    kind: 'MUSIC',
    access: 'PREMIUM',
    slug: 'focus-drone',
    category: 'burnout',
    titleRu: 'Ровный фон для работы',
    titleKk: 'Жұмысқа арналған біркелкі фон',
    summaryRu: 'Без мелодии и резких переходов',
    summaryKk: 'Әуенсіз және күрт ауысуларсыз',
    durationSec: 2700,
    payload: { audioKey: 'music/focus-drone.mp3' },
  },
];

async function main() {
  for (const [i, [slug, nameRu, nameKz]] of TOPICS.entries()) {
    await prisma.topic.upsert({
      where: { slug },
      update: { nameRu, nameKz, sortOrder: i },
      create: { slug, nameRu, nameKz, sortOrder: i },
    });
  }

  for (const [i, item] of CONTENT.entries()) {
    // Демо-материалы публикуются сразу: незаметный черновик в сидах —
    // ровно тот случай, когда «ничего не видно» списывают на баг.
    await prisma.contentItem.upsert({
      where: { slug: item.slug },
      update: { ...item, sortOrder: i * 10, publishedAt: new Date() },
      create: { ...item, sortOrder: i * 10, publishedAt: new Date() },
    });
  }
}

main().finally(() => prisma.$disconnect());
