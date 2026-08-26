import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { VerificationStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp } from './utils/create-app';
import { clientUser as clientUserHelper } from './utils/client-helpers';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';

// Пагинация каталога и избранного (E11a, задача 7). Каталог рос без
// ограничения: с наполнением базы один запрос вытаскивал бы всех
// верифицированных экспертов разом.
const PHONE_PREFIX = '+7709900';
const DISPLAY_PREFIX = 'pagination-e2e-';
const CLIENT_PHONE = '+77099009999';
const TOTAL_EXPERTS = 25;

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    if (match) lastCode = match[1];
  }
}

describe('Пагинация каталога и избранного (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let topicId: string;
  const expertIds: string[] = [];

  async function cleanup() {
    await prisma.favorite.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expertTopic.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expert.deleteMany({
      where: { displayName: { startsWith: DISPLAY_PREFIX } },
    });
    const users = await prisma.user.findMany({
      where: { phone: { startsWith: PHONE_PREFIX } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (ids.length) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
      await prisma.favorite.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.smsCode.deleteMany({
      where: { phone: { startsWith: PHONE_PREFIX } },
    });
    expertIds.length = 0;
  }

  /// 25 верифицированных экспертов одной темы с ОДИНАКОВОЙ ценой: равные
  /// значения — как раз тот случай, где сортировка без вторичного ключа
  /// даёт недетерминированные страницы.
  async function seedExperts() {
    const topic = await prisma.topic.findFirstOrThrow({
      where: { slug: 'anxiety-stress' },
    });
    topicId = topic.id;

    for (let i = 0; i < TOTAL_EXPERTS; i++) {
      const user = await prisma.user.create({
        data: { phone: `${PHONE_PREFIX}${String(i).padStart(3, '0')}` },
      });
      const expert = await prisma.expert.create({
        data: {
          user: { connect: { id: user.id } },
          displayName: `${DISPLAY_PREFIX}${i}`,
          education: 'КазНУ, клиническая психология',
          city: 'Алматы',
          experience: 'THREE_TO_FIVE',
          priceTiyn: 399000,
          languages: ['ru'],
          formats: ['chat'],
          verificationStatus: VerificationStatus.VERIFIED,
          topics: { create: { topic: { connect: { id: topicId } } } },
        },
      });
      expertIds.push(expert.id);
    }
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    await cleanup();
    await seedExperts();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  const catalog = (query: string) =>
    request(app.getHttpServer()).get(`/v1/experts?${query}`);

  it('take ограничивает страницу, страницы не пересекаются и не теряют записи', async () => {
    const query = `topic=anxiety-stress&sort=price_asc`;
    const first = await catalog(`${query}&take=10&skip=0`).expect(200);
    const second = await catalog(`${query}&take=10&skip=10`).expect(200);
    const third = await catalog(`${query}&take=10&skip=20`).expect(200);

    expect(first.body).toHaveLength(10);
    expect(second.body).toHaveLength(10);

    const ids = [...first.body, ...second.body, ...third.body].map(
      (e: { id: string }) => e.id,
    );
    const ours = ids.filter((id) => expertIds.includes(id));
    expect(new Set(ours).size).toBe(ours.length);
    expect(ours.length).toBeGreaterThanOrEqual(TOTAL_EXPERTS);
  });

  it('порядок при равной цене детерминирован между запросами', async () => {
    // Без вторичного ключа id две страницы могли бы содержать одного
    // эксперта дважды и потерять другого.
    const query = 'topic=anxiety-stress&sort=price_asc&take=10&skip=0';
    const a = await catalog(query).expect(200);
    const b = await catalog(query).expect(200);

    expect(a.body.map((e: { id: string }) => e.id)).toEqual(
      b.body.map((e: { id: string }) => e.id),
    );
  });

  it('take больше сотни отклоняется', async () => {
    await catalog('take=101').expect(400);
    await catalog('take=0').expect(400);
    await catalog('skip=-1').expect(400);
  });

  it('вызов без параметров отдаёт первую страницу, а не всех сразу', async () => {
    const res = await catalog('topic=anxiety-stress').expect(200);
    expect(res.body.length).toBeLessThanOrEqual(20);
  });

  it('избранное листается теми же параметрами', async () => {
    const client = await clientUserHelper(app, CLIENT_PHONE, () => lastCode);
    for (const expertId of expertIds.slice(0, 25)) {
      await request(app.getHttpServer())
        .put(`/v1/favorites/${expertId}`)
        .set('Authorization', `Bearer ${client.accessToken}`)
        .expect(204);
    }

    const first = await request(app.getHttpServer())
      .get('/v1/favorites?take=10&skip=0')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/v1/favorites?take=10&skip=10')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(200);

    expect(first.body).toHaveLength(10);
    expect(second.body).toHaveLength(10);
    const ids = [...first.body, ...second.body].map(
      (e: { id: string }) => e.id,
    );
    expect(new Set(ids).size).toBe(ids.length);

    await request(app.getHttpServer())
      .get('/v1/favorites?take=101')
      .set('Authorization', `Bearer ${client.accessToken}`)
      .expect(400);
  });
});
