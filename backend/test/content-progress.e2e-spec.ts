import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { clientUser } from './utils/client-helpers';

const PH_C1 = '+77087700001';
const ALL_PHONES = [PH_C1];
const SLUG_PREFIX = 'e2e-progress-';

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

describe('Контент: прогресс, голоса и стрик (E13, e2e)', () => {
  let prisma: PrismaService;
  let itemId = '';

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
    const item = await prisma.contentItem.create({
      data: {
        kind: 'ARTICLE',
        access: 'FREE',
        slug: `${SLUG_PREFIX}article`,
        category: 'anxiety',
        titleRu: 'Статья',
        titleKk: 'Мақала',
        summaryRu: 'Кратко',
        summaryKk: 'Қысқаша',
        payload: { markdownRu: '# Текст', markdownKk: '# Мәтін' },
        publishedAt: new Date(),
      },
    });
    itemId = item.id;
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

  it('прогресс перезаписывается, а не плодит строки; 1000 = завершено', async () => {
    const cli = await clientUser(app, PH_C1, () => lastCode);

    await post(cli.accessToken, `/v1/content/${itemId}/progress`)
      .send({ positionPermille: 300 })
      .expect(200);
    await post(cli.accessToken, `/v1/content/${itemId}/progress`)
      .send({ positionPermille: 1000 })
      .expect(200);

    const rows = await prisma.contentProgress.findMany({
      where: { userId: cli.userId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].positionPermille).toBe(1000);
    expect(rows[0].completedAt).not.toBeNull();
  });

  it('перечитывание с начала не «разучивает» материал', async () => {
    const cli = await clientUser(app, PH_C1, () => lastCode);
    await post(cli.accessToken, `/v1/content/${itemId}/progress`)
      .send({ positionPermille: 1000 })
      .expect(200);
    await post(cli.accessToken, `/v1/content/${itemId}/progress`)
      .send({ positionPermille: 100 })
      .expect(200);

    const row = await prisma.contentProgress.findFirstOrThrow({
      where: { userId: cli.userId },
    });
    expect(row.positionPermille).toBe(100);
    // Завершение — факт биографии, а не текущее положение ползунка.
    expect(row.completedAt).not.toBeNull();
  });

  it('позиция вне диапазона 0–1000 отвергается', async () => {
    const cli = await clientUser(app, PH_C1, () => lastCode);
    await post(cli.accessToken, `/v1/content/${itemId}/progress`)
      .send({ positionPermille: 1500 })
      .expect(400);
    await post(cli.accessToken, `/v1/content/${itemId}/progress`)
      .send({ positionPermille: -1 })
      .expect(400);
  });

  it('голос «было полезно» — один на пользователя, повтор меняет решение', async () => {
    const cli = await clientUser(app, PH_C1, () => lastCode);

    await post(cli.accessToken, `/v1/content/${itemId}/vote`)
      .send({ useful: true })
      .expect(200);
    let item = await prisma.contentItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    expect(item.usefulYes).toBe(1);

    await post(cli.accessToken, `/v1/content/${itemId}/vote`)
      .send({ useful: false })
      .expect(200);
    item = await prisma.contentItem.findUniqueOrThrow({
      where: { id: itemId },
    });
    // Счётчики обязаны сходиться с числом строк: один человек — один голос.
    expect(item.usefulYes).toBe(0);
    expect(item.usefulNo).toBe(1);
    expect(await prisma.contentVote.count({ where: { itemId } })).toBe(1);
  });

  it('стрик и счётчик завершённых приходят вместе', async () => {
    const cli = await clientUser(app, PH_C1, () => lastCode);
    await post(cli.accessToken, `/v1/content/${itemId}/progress`)
      .send({ positionPermille: 1000 })
      .expect(200);

    const res = await get(cli.accessToken, '/v1/content/streak').expect(200);
    expect(res.body).toMatchObject({
      currentDays: 1,
      longestDays: 1,
      completedCount: 1,
    });
  });

  it('прогресс по черновику невозможен: 404', async () => {
    const cli = await clientUser(app, PH_C1, () => lastCode);
    const draft = await prisma.contentItem.create({
      data: {
        kind: 'ARTICLE',
        access: 'FREE',
        slug: `${SLUG_PREFIX}draft`,
        category: 'anxiety',
        titleRu: 'Черновик',
        titleKk: 'Жоба',
        summaryRu: '-',
        summaryKk: '-',
        payload: { markdownRu: '#', markdownKk: '#' },
      },
    });

    await post(cli.accessToken, `/v1/content/${draft.id}/progress`)
      .send({ positionPermille: 100 })
      .expect(404);
  });
});
