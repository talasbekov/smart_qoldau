import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { clientUser } from './utils/client-helpers';

// Пейволл обязан стоять ДО выдачи ссылки: ссылка на объект в бакете и есть
// доступ к нему. Спек проверяет именно это, а не наличие замка в интерфейсе.
const PH_C1 = '+77087600001';
const ALL_PHONES = [PH_C1];
const SLUG_PREFIX = 'e2e-paywall-';

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
function post(token: string, url: string) {
  return request(app.getHttpServer())
    .post(url)
    .set('Authorization', `Bearer ${token}`);
}

describe('Контент: пейволл Premium (E13, e2e)', () => {
  let prisma: PrismaService;
  let premiumId = '';
  let freeId = '';
  let premiumArticleId = '';

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const subs = await prisma.subscription.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const txs = subs.length
      ? await prisma.ledgerTransaction.findMany({
          where: {
            kind: 'subscription_charge',
            OR: subs.map((s) => ({ refId: { startsWith: s.id } })),
          },
          select: { id: true },
        })
      : [];
    const txIds = txs.map((t) => t.id);
    await prisma.ledgerEntry.deleteMany({
      where: { transactionId: { in: txIds } },
    });
    await prisma.ledgerTransaction.deleteMany({ where: { id: { in: txIds } } });
    await prisma.contentProgress.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.contentItem.deleteMany({
      where: { slug: { startsWith: SLUG_PREFIX } },
    });
    await prisma.subscription.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.paymentMethod.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...userIds, ...subs.map((s) => s.id)] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  async function seedContent() {
    const paid = await prisma.contentItem.create({
      data: {
        kind: 'MEDITATION',
        access: 'PREMIUM',
        slug: `${SLUG_PREFIX}meditation`,
        category: 'sleep',
        titleRu: 'Глубокий сон',
        titleKk: 'Терең ұйқы',
        summaryRu: '20 минут',
        summaryKk: '20 минут',
        payload: { audioKey: 'meditations/sleep-1.mp3' },
        durationSec: 1200,
        publishedAt: new Date(),
      },
    });
    premiumId = paid.id;

    const free = await prisma.contentItem.create({
      data: {
        kind: 'MEDITATION',
        access: 'FREE',
        slug: `${SLUG_PREFIX}free`,
        category: 'sleep',
        titleRu: 'Короткая практика',
        titleKk: 'Қысқа тәжірибе',
        summaryRu: '5 минут',
        summaryKk: '5 минут',
        payload: { audioKey: 'meditations/free-1.mp3' },
        durationSec: 300,
        publishedAt: new Date(),
      },
    });
    freeId = free.id;

    // Платная СТАТЬЯ: у неё, в отличие от медитации, всё содержимое лежит
    // в теле ответа карточки, а не за подписанной ссылкой.
    const paidArticle = await prisma.contentItem.create({
      data: {
        kind: 'ARTICLE',
        access: 'PREMIUM',
        slug: `${SLUG_PREFIX}paid-article`,
        category: 'anxiety',
        titleRu: 'Платная статья',
        titleKk: 'Ақылы мақала',
        summaryRu: 'Только для Premium',
        summaryKk: 'Тек Premium үшін',
        payload: {
          markdownRu: '# Секретный текст за подпиской',
          markdownKk: '# Жазылым артындағы мәтін',
        },
        durationSec: 300,
        publishedAt: new Date(),
      },
    });
    premiumArticleId = paidArticle.id;
  }

  async function subscribe(token: string) {
    const card = await post(token, '/v1/payment-methods')
      .send({
        pan: '4111111111111111',
        expiry: '12/30',
        holderName: 'I IVANOV',
      })
      .expect(201);
    await post(token, '/v1/premium/subscribe')
      .send({ plan: 'MONTH', paymentMethodId: card.body.id })
      .expect(201);
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

  it('без подписки: карточка видна с замком, ссылки на аудио нет', async () => {
    const cli = await clientUser(app, PH_C1, () => lastCode);

    const card = await get(cli.accessToken, `/v1/content/${premiumId}`).expect(
      200,
    );
    // Карточку показываем: человек должен понимать, ЧТО за пейволлом.
    expect(card.body.locked).toBe(true);
    expect(card.body.title).toBe('Глубокий сон');

    const res = await get(
      cli.accessToken,
      `/v1/content/${premiumId}/media`,
    ).expect(403);
    expect(res.body.error.code).toBe('PREMIUM_REQUIRED');
    expect(res.body.url).toBeUndefined();
    // Ключ файла наружу не уходит вообще — иначе пейволл обходится
    // знанием имени объекта.
    expect(JSON.stringify(res.body)).not.toContain('sleep-1.mp3');
  });

  it('без подписки тело платной СТАТЬИ не отдаётся: иначе пейволла нет', async () => {
    const cli = await clientUser(app, PH_C1, () => lastCode);

    const card = await get(
      cli.accessToken,
      `/v1/content/${premiumArticleId}`,
    ).expect(200);

    // Карточка видна — человек должен понимать, что за пейволлом.
    expect(card.body.locked).toBe(true);
    expect(card.body.title).toBe('Платная статья');
    // А текста нет. У медитации пейволл стоит на подписанной ссылке, у
    // статьи её нет вовсе: содержимое приходит прямо в карточке, и без
    // этой проверки платную статью читает кто угодно.
    expect(card.body.body).toBeUndefined();
    expect(JSON.stringify(card.body)).not.toContain('Секретный текст');
  });

  it('с подпиской тело платной статьи отдаётся', async () => {
    const cli = await clientUser(app, PH_C1, () => lastCode);
    await subscribe(cli.accessToken);

    const card = await get(
      cli.accessToken,
      `/v1/content/${premiumArticleId}`,
    ).expect(200);

    expect(card.body.locked).toBe(false);
    expect(card.body.body.markdown).toContain('Секретный текст');
  });

  it('аноним видит список материалов: страницы существуют ради поиска', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/content?take=50')
      .expect(200);

    const slugs = (res.body as { slug: string }[]).map((i) => i.slug);
    expect(slugs).toContain(`${SLUG_PREFIX}free`);
    expect(slugs).toContain(`${SLUG_PREFIX}meditation`);
  });

  it('аноним видит карточку платного материала, но не его текст', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/content/${premiumArticleId}`)
      .expect(200);

    // Карточка нужна поисковику и человеку: он должен понимать, что
    // именно за пейволлом. Текст — нет.
    expect(res.body.title).toBe('Платная статья');
    expect(res.body.locked).toBe(true);
    expect(res.body.body).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('Секретный текст');
  });

  it('аноним получает материалы на запрошенном языке', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/content/${premiumArticleId}?locale=kk`)
      .expect(200);

    // У анонима нет профиля с локалью — язык приходит из адреса страницы.
    expect(res.body.title).toBe('Ақылы мақала');
  });

  it('бесплатный материал доступен без подписки', async () => {
    const cli = await clientUser(app, PH_C1, () => lastCode);
    const res = await get(
      cli.accessToken,
      `/v1/content/${freeId}/media`,
    ).expect(200);
    const mediaUrl = new URL(res.body.url);
    const expectedEndpoint =
      process.env.S3_CONTENT_PUBLIC_ENDPOINT ??
      process.env.S3_ENDPOINT ??
      'http://localhost:9000';
    expect(mediaUrl.origin).toBe(new URL(expectedEndpoint).origin);
    expect(mediaUrl.pathname).toBe(
      `/${process.env.S3_BUCKET_CONTENT ?? 'sq-content'}/meditations/free-1.mp3`,
    );
    expect(mediaUrl.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('с подпиской: ссылка выдаётся и истекает', async () => {
    const cli = await clientUser(app, PH_C1, () => lastCode);
    await subscribe(cli.accessToken);

    const card = await get(cli.accessToken, `/v1/content/${premiumId}`).expect(
      200,
    );
    expect(card.body.locked).toBe(false);

    const res = await get(
      cli.accessToken,
      `/v1/content/${premiumId}/media`,
    ).expect(200);
    expect(res.body.url).toContain('X-Amz-Expires');
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('отмена подписки не отбирает доступ до конца периода (Р-09)', async () => {
    const cli = await clientUser(app, PH_C1, () => lastCode);
    await subscribe(cli.accessToken);
    await post(cli.accessToken, '/v1/premium/cancel').expect(200);

    await get(cli.accessToken, `/v1/content/${premiumId}/media`).expect(200);
  });

  it('у статьи ссылки на медиа нет: 409, а не пустой url', async () => {
    const cli = await clientUser(app, PH_C1, () => lastCode);
    const article = await prisma.contentItem.create({
      data: {
        kind: 'ARTICLE',
        access: 'FREE',
        slug: `${SLUG_PREFIX}article`,
        category: 'sleep',
        titleRu: 'Статья',
        titleKk: 'Мақала',
        summaryRu: 'Кратко',
        summaryKk: 'Қысқаша',
        payload: { markdownRu: '# Текст', markdownKk: '# Мәтін' },
        publishedAt: new Date(),
      },
    });

    const res = await get(
      cli.accessToken,
      `/v1/content/${article.id}/media`,
    ).expect(409);
    expect(res.body.error.code).toBe('CONTENT_HAS_NO_MEDIA');
  });
});
