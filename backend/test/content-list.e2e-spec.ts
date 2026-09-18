import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { clientUser } from './utils/client-helpers';

const PH_RU = '+77087500001';
const PH_KZ = '+77087500002';
const ALL_PHONES = [PH_RU, PH_KZ];
const SLUG_PREFIX = 'e2e-content-';
const CATEGORY_ANXIETY = `${SLUG_PREFIX}anxiety`;
const CATEGORY_FOCUS = `${SLUG_PREFIX}focus`;

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    lastCode = match ? match[1] : '';
  }
}

let app: INestApplication;

function get(token: string, url: string) {
  return request(app.getHttpServer())
    .get(url)
    .set('Authorization', `Bearer ${token}`);
}
function patch(token: string, url: string) {
  return request(app.getHttpServer())
    .patch(url)
    .set('Authorization', `Bearer ${token}`);
}

describe('Контент: списки и карточки (E13, e2e)', () => {
  let prisma: PrismaService;
  let articleId = '';
  let breathingId = '';

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    await prisma.contentProgress.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.contentVote.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.contentItem.deleteMany({
      where: { slug: { startsWith: SLUG_PREFIX } },
    });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  async function seedContent() {
    const article = await prisma.contentItem.create({
      data: {
        kind: 'ARTICLE',
        access: 'FREE',
        slug: `${SLUG_PREFIX}article`,
        category: CATEGORY_ANXIETY,
        titleRu: 'Как справиться с тревогой',
        titleKk: 'Мазасыздықпен қалай күресуге болады',
        summaryRu: 'Кратко',
        summaryKk: 'Қысқаша',
        payload: { markdownRu: '# Привет', markdownKk: '# Сәлем' },
        sortOrder: 10,
        publishedAt: new Date(),
      },
    });
    articleId = article.id;

    const breathing = await prisma.contentItem.create({
      data: {
        kind: 'BREATHING',
        access: 'FREE',
        slug: `${SLUG_PREFIX}breathing`,
        category: CATEGORY_ANXIETY,
        titleRu: 'Квадратное дыхание',
        titleKk: 'Шаршы тыныс алу',
        summaryRu: 'Четыре фазы по 4 секунды',
        summaryKk: 'Төрт фаза, әрқайсысы 4 секунд',
        payload: {
          cycles: 5,
          phases: [
            { nameRu: 'Вдох', nameKk: 'Дем алу', seconds: 4 },
            { nameRu: 'Задержка', nameKk: 'Ұстау', seconds: 4 },
            { nameRu: 'Выдох', nameKk: 'Дем шығару', seconds: 4 },
          ],
        },
        sortOrder: 20,
        publishedAt: new Date(),
      },
    });
    breathingId = breathing.id;

    // Черновик: редактор ещё пишет — клиенту его видеть нельзя.
    await prisma.contentItem.create({
      data: {
        kind: 'ARTICLE',
        access: 'FREE',
        slug: `${SLUG_PREFIX}draft`,
        category: CATEGORY_ANXIETY,
        titleRu: 'Черновик',
        titleKk: 'Жоба',
        summaryRu: 'Не готово',
        summaryKk: 'Дайын емес',
        payload: { markdownRu: '# Черновик', markdownKk: '# Жоба' },
        sortOrder: 5,
      },
    });

    // Материал без казахского перевода: русскому пользователю виден,
    // казахскому — нет. Экран на чужом языке хуже короткого списка.
    await prisma.contentItem.create({
      data: {
        kind: 'ARTICLE',
        access: 'FREE',
        slug: `${SLUG_PREFIX}ru-only`,
        category: CATEGORY_FOCUS,
        titleRu: 'Только по-русски',
        titleKk: '',
        summaryRu: 'Перевода нет',
        summaryKk: '',
        payload: { markdownRu: '# Только по-русски', markdownKk: '' },
        sortOrder: 30,
        publishedAt: new Date(),
      },
    });
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await cleanup();
    await seedContent();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('список отдаёт только опубликованное, на языке пользователя', async () => {
    const ru = await clientUser(app, PH_RU, () => lastCode);
    const res = await get(
      ru.accessToken,
      `/v1/content?category=${CATEGORY_ANXIETY}`,
    ).expect(200);

    const slugs = res.body.map((i: { slug: string }) => i.slug);
    expect(slugs).toContain(`${SLUG_PREFIX}article`);
    // Черновик не показывается никому.
    expect(slugs).not.toContain(`${SLUG_PREFIX}draft`);
    expect(
      res.body.find(
        (item: { slug: string }) => item.slug === `${SLUG_PREFIX}article`,
      )?.title,
    ).toBe('Как справиться с тревогой');

    const focus = await get(
      ru.accessToken,
      `/v1/content?category=${CATEGORY_FOCUS}`,
    ).expect(200);
    expect(focus.body.map((i: { slug: string }) => i.slug)).toEqual([
      `${SLUG_PREFIX}ru-only`,
    ]);
  });

  it('казахскому пользователю материал без перевода не показывается', async () => {
    const kz = await clientUser(app, PH_KZ, () => lastCode);
    await patch(kz.accessToken, '/v1/me/locale')
      .send({ locale: 'kz' })
      .expect(200);

    const res = await get(
      kz.accessToken,
      `/v1/content?category=${CATEGORY_ANXIETY}`,
    ).expect(200);
    const slugs = res.body.map((i: { slug: string }) => i.slug);
    expect(slugs).toContain(`${SLUG_PREFIX}article`);
    expect(
      res.body.find(
        (item: { slug: string }) => item.slug === `${SLUG_PREFIX}article`,
      )?.title,
    ).toBe('Мазасыздықпен қалай күресуге болады');

    const focus = await get(
      kz.accessToken,
      `/v1/content?category=${CATEGORY_FOCUS}`,
    ).expect(200);
    expect(focus.body).toEqual([]);
  });

  it('фильтры по виду и категории сужают список', async () => {
    const ru = await clientUser(app, PH_RU, () => lastCode);

    const breathing = await get(
      ru.accessToken,
      `/v1/content?kind=BREATHING&category=${CATEGORY_ANXIETY}`,
    ).expect(200);
    expect(breathing.body.map((i: { slug: string }) => i.slug)).toEqual([
      `${SLUG_PREFIX}breathing`,
    ]);

    const focus = await get(
      ru.accessToken,
      `/v1/content?category=${CATEGORY_FOCUS}`,
    ).expect(200);
    expect(focus.body.map((i: { slug: string }) => i.slug)).toEqual([
      `${SLUG_PREFIX}ru-only`,
    ]);
  });

  it('карточка статьи отдаёт markdown на языке пользователя', async () => {
    const ru = await clientUser(app, PH_RU, () => lastCode);
    const res = await get(ru.accessToken, `/v1/content/${articleId}`).expect(
      200,
    );

    expect(res.body.title).toBe('Как справиться с тревогой');
    expect(res.body.body.markdown).toContain('# Привет');
    // Бесплатный материал не заперт.
    expect(res.body.locked).toBe(false);
  });

  it('дыхательная техника отдаёт фазы, а не markdown', async () => {
    const ru = await clientUser(app, PH_RU, () => lastCode);
    const res = await get(ru.accessToken, `/v1/content/${breathingId}`).expect(
      200,
    );

    expect(res.body.body.cycles).toBe(5);
    expect(res.body.body.phases[0]).toMatchObject({ name: 'Вдох', seconds: 4 });
    expect(res.body.body.markdown).toBeUndefined();
  });

  it('черновик и несуществующий id -> 404 CONTENT_NOT_FOUND', async () => {
    const ru = await clientUser(app, PH_RU, () => lastCode);
    const draft = await prisma.contentItem.findUniqueOrThrow({
      where: { slug: `${SLUG_PREFIX}draft` },
    });

    const byDraft = await get(ru.accessToken, `/v1/content/${draft.id}`).expect(
      404,
    );
    expect(byDraft.body.error.code).toBe('CONTENT_NOT_FOUND');

    const draftMedia = await get(
      ru.accessToken,
      `/v1/content/${draft.id}/media`,
    ).expect(404);
    expect(draftMedia.body.error.code).toBe('CONTENT_NOT_FOUND');

    await get(
      ru.accessToken,
      '/v1/content/00000000-0000-0000-0000-000000000000',
    ).expect(404);
    const missingMedia = await get(
      ru.accessToken,
      '/v1/content/00000000-0000-0000-0000-000000000000/media',
    ).expect(404);
    expect(missingMedia.body.error.code).toBe('CONTENT_NOT_FOUND');
  });

  it('обложка отдаётся подписанной ссылкой, а не ключом хранилища', async () => {
    const ru = await clientUser(app, PH_RU, () => lastCode);
    await prisma.contentItem.update({
      where: { id: articleId },
      data: { coverKey: 'covers/article.webp' },
    });

    const res = await get(ru.accessToken, `/v1/content/${articleId}`).expect(
      200,
    );
    // Ключ сам по себе бесполезен: бакет закрыт, картинку по нему не
    // загрузить — поле обязано содержать ссылку, а не имя объекта.
    expect(res.body.coverUrl).toContain('X-Amz-Signature');
    expect(res.body.coverUrl).toContain('covers/article.webp');
  });

  it('список ограничен страницей: take и skip', async () => {
    const ru = await clientUser(app, PH_RU, () => lastCode);

    const firstPage = await get(
      ru.accessToken,
      `/v1/content?category=${CATEGORY_ANXIETY}&take=1`,
    ).expect(200);
    expect(firstPage.body.map((i: { slug: string }) => i.slug)).toEqual([
      `${SLUG_PREFIX}article`,
    ]);

    const secondPage = await get(
      ru.accessToken,
      `/v1/content?category=${CATEGORY_ANXIETY}&take=1&skip=1`,
    ).expect(200);
    expect(secondPage.body.map((i: { slug: string }) => i.slug)).toEqual([
      `${SLUG_PREFIX}breathing`,
    ]);
  });

  it('список и карточка открыты без токена — они существуют ради поиска', async () => {
    await request(app.getHttpServer()).get('/v1/content').expect(200);
    await request(app.getHttpServer())
      .get(`/v1/content/${articleId}`)
      .expect(200);
  });

  it('личные маршруты по-прежнему требуют токен', async () => {
    // Прогресс, голос, стрик и ссылка на медиа — про конкретного
    // человека. Открытие списка анониму их не касается.
    await request(app.getHttpServer()).get('/v1/content/streak').expect(401);
    await request(app.getHttpServer())
      .get(`/v1/content/${articleId}/media`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/v1/content/${articleId}/progress`)
      .send({ positionPermille: 100 })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/v1/content/${articleId}/vote`)
      .send({ useful: true })
      .expect(401);
  });
});
