import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/storage/storage.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { adminUser } from './utils/admin-helpers';
import { clientUser } from './utils/client-helpers';

const SLUG_PREFIX = 'e2e-cms-';
const CATEGORY = 'e2e-cms';
const EDITOR_EMAIL = 'e2e-content-editor@smartqoldau.kz';
const OPERATOR_EMAIL = 'e2e-content-outsider@smartqoldau.kz';
const PH_C1 = '+77087800001';

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
function patch(token: string, url: string) {
  return request(app.getHttpServer())
    .patch(url)
    .set('Authorization', `Bearer ${token}`);
}
function del(token: string, url: string) {
  return request(app.getHttpServer())
    .delete(url)
    .set('Authorization', `Bearer ${token}`);
}

const ARTICLE = {
  kind: 'ARTICLE',
  access: 'FREE',
  slug: `${SLUG_PREFIX}article`,
  category: CATEGORY,
  titleRu: 'Как справиться с тревогой',
  titleKk: 'Мазасыздық',
  summaryRu: 'Кратко',
  summaryKk: 'Қысқаша',
  payload: { markdownRu: '# Привет', markdownKk: '# Сәлем' },
  sortOrder: 10,
};

const AUDIO_DRAFT = {
  ...ARTICLE,
  kind: 'MEDITATION',
  slug: `${SLUG_PREFIX}meditation`,
  titleRu: 'Спокойная медитация',
  titleKk: 'Тыныш медитация',
  payload: {},
  published: false,
};

const MP3 = Buffer.from([0xff, 0xfb, 0x90, 0x00]);

describe('Контент: CMS редактора (E13, e2e)', () => {
  let prisma: PrismaService;
  let storage: StorageService;

  async function cleanup() {
    const audioItems = await prisma.contentItem.findMany({
      where: { slug: { startsWith: SLUG_PREFIX } },
      select: { payload: true },
    });
    await Promise.all(
      audioItems.map(async ({ payload }) => {
        const value = payload as Record<string, unknown>;
        if (typeof value.audioKey === 'string') {
          await storage
            .deleteContentObject(value.audioKey)
            .catch(() => undefined);
        }
      }),
    );
    const users = await prisma.user.findMany({
      where: { phone: { in: [PH_C1] } },
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
    await prisma.smsCode.deleteMany({ where: { phone: { in: [PH_C1] } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    const admins = await prisma.adminUser.findMany({
      where: { email: { in: [EDITOR_EMAIL, OPERATOR_EMAIL] } },
      select: { id: true },
    });
    const adminIds = admins.map((a) => a.id);
    await prisma.adminRefreshToken.deleteMany({
      where: { adminUserId: { in: adminIds } },
    });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: adminIds } } });
    await prisma.adminUser.deleteMany({ where: { id: { in: adminIds } } });
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    storage = app.get(StorageService);
  });

  beforeEach(() => cleanup());

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  function editor() {
    return adminUser(app, ['CONTENT_EDITOR'], EDITOR_EMAIL);
  }

  async function clientFixtureSlugs(token: string): Promise<string[]> {
    const res = await get(token, `/v1/content?category=${CATEGORY}`).expect(
      200,
    );
    return res.body
      .map((item: { slug: string }) => item.slug)
      .filter((slug: string) => slug.startsWith(SLUG_PREFIX));
  }

  it('редактор создаёт черновик, публикует и снимает с публикации', async () => {
    const ed = await editor();
    const cli = await clientUser(app, PH_C1, () => lastCode);

    const created = await post(ed.token, '/v1/admin/content')
      .send(ARTICLE)
      .expect(201);
    expect(created.body.publishedAt).toBeNull();
    // Черновик клиенту не виден — редактор готовит его сколько нужно.
    expect(await clientFixtureSlugs(cli.accessToken)).toEqual([]);

    await patch(ed.token, `/v1/admin/content/${created.body.id}`)
      .send({ published: true })
      .expect(200);
    expect(await clientFixtureSlugs(cli.accessToken)).toEqual([
      `${SLUG_PREFIX}article`,
    ]);

    await patch(ed.token, `/v1/admin/content/${created.body.id}`)
      .send({ published: false })
      .expect(200);
    expect(await clientFixtureSlugs(cli.accessToken)).toEqual([]);
  });

  it('список редактора показывает и черновики', async () => {
    const ed = await editor();
    await post(ed.token, '/v1/admin/content').send(ARTICLE).expect(201);

    const res = await get(ed.token, '/v1/admin/content').expect(200);
    expect(res.body.map((i: { slug: string }) => i.slug)).toContain(
      `${SLUG_PREFIX}article`,
    );
  });

  it('тело валидируется по виду: статье нужен markdown, дыханию — фазы', async () => {
    const ed = await editor();

    const wrongArticle = await post(ed.token, '/v1/admin/content')
      .send({ ...ARTICLE, payload: { phases: [] } })
      .expect(400);
    expect(wrongArticle.body.error.code).toBe('VALIDATION_FAILED');

    const wrongBreathing = await post(ed.token, '/v1/admin/content')
      .send({
        ...ARTICLE,
        kind: 'BREATHING',
        slug: `${SLUG_PREFIX}breathing`,
        payload: { markdownRu: '#', markdownKk: '#' },
      })
      .expect(400);
    expect(wrongBreathing.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('создаёт аудио-черновик, загружает и заменяет MP3, затем разрешает публикацию', async () => {
    const ed = await editor();
    const cli = await clientUser(app, PH_C1, () => lastCode);
    const created = await post(ed.token, '/v1/admin/content')
      .send(AUDIO_DRAFT)
      .expect(201);

    expect(created.body.payload).toEqual({});
    expect(created.body.publishedAt).toBeNull();
    expect(await clientFixtureSlugs(cli.accessToken)).toEqual([]);

    const blocked = await patch(
      ed.token,
      `/v1/admin/content/${created.body.id}`,
    )
      .send({ published: true })
      .expect(400);
    expect(blocked.body.error.code).toBe('VALIDATION_FAILED');

    const uploaded = await post(
      ed.token,
      `/v1/admin/content/${created.body.id}/audio`,
    )
      .attach('file', MP3, {
        filename: 'calm.mp3',
        contentType: 'audio/mpeg',
      })
      .expect(200);
    expect(uploaded.body.payload.audioKey).toMatch(
      new RegExp(`^content/${created.body.id}/[0-9a-f-]{36}\\.mp3$`),
    );
    expect(uploaded.body.payload.audioKey).not.toBe('calm.mp3');

    const replaced = await post(
      ed.token,
      `/v1/admin/content/${created.body.id}/audio`,
    )
      .attach('file', MP3, {
        filename: 'replacement.mp3',
        contentType: 'audio/mpeg',
      })
      .expect(200);
    expect(replaced.body.payload.audioKey).not.toBe(
      uploaded.body.payload.audioKey,
    );

    await patch(ed.token, `/v1/admin/content/${created.body.id}`)
      .send({ published: true })
      .expect(200);
    expect(await clientFixtureSlugs(cli.accessToken)).toEqual([
      AUDIO_DRAFT.slug,
    ]);
  });

  it('отклоняет отсутствующий, подозрительный и слишком большой аудиофайл', async () => {
    const ed = await editor();
    const created = await post(ed.token, '/v1/admin/content')
      .send(AUDIO_DRAFT)
      .expect(201);
    const url = `/v1/admin/content/${created.body.id}/audio`;

    const missing = await post(ed.token, url).expect(400);
    expect(missing.body.error.code).toBe('VALIDATION_FAILED');

    const suspicious = await post(ed.token, url)
      .attach('file', Buffer.from('not an mp3'), {
        filename: 'fake.mp3',
        contentType: 'audio/mpeg',
      })
      .expect(400);
    expect(suspicious.body.error.code).toBe('VALIDATION_FAILED');

    const tooLarge = await post(ed.token, url)
      .attach('file', Buffer.alloc(25 * 1024 * 1024 + 1, 0xff), {
        filename: 'large.mp3',
        contentType: 'audio/mpeg',
      })
      .expect(413);
    expect(tooLarge.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('не принимает аудио для другого вида и не пускает роль без прав', async () => {
    const ed = await editor();
    const outsider = await adminUser(
      app,
      ['VERIFICATION_OPERATOR'],
      OPERATOR_EMAIL,
    );
    const article = await post(ed.token, '/v1/admin/content')
      .send(ARTICLE)
      .expect(201);

    const wrongKind = await post(
      ed.token,
      `/v1/admin/content/${article.body.id}/audio`,
    )
      .attach('file', MP3, {
        filename: 'calm.mp3',
        contentType: 'audio/mpeg',
      })
      .expect(400);
    expect(wrongKind.body.error.code).toBe('VALIDATION_FAILED');

    await post(outsider.token, `/v1/admin/content/${article.body.id}/audio`)
      .attach('file', MP3, {
        filename: 'calm.mp3',
        contentType: 'audio/mpeg',
      })
      .expect(403);
  });

  it('не принимает audioKey из JSON и не создаёт аудио сразу опубликованным', async () => {
    const ed = await editor();

    const suppliedKey = await post(ed.token, '/v1/admin/content')
      .send({ ...AUDIO_DRAFT, payload: { audioKey: 'shared/manual.mp3' } })
      .expect(400);
    expect(suppliedKey.body.error.code).toBe('VALIDATION_FAILED');

    const published = await post(ed.token, '/v1/admin/content')
      .send({
        ...AUDIO_DRAFT,
        slug: `${SLUG_PREFIX}published`,
        published: true,
      })
      .expect(400);
    expect(published.body.error.code).toBe('VALIDATION_FAILED');

    const created = await post(ed.token, '/v1/admin/content')
      .send(AUDIO_DRAFT)
      .expect(201);
    const patched = await patch(
      ed.token,
      `/v1/admin/content/${created.body.id}`,
    )
      .send({ payload: { audioKey: 'shared/manual.mp3' } })
      .expect(400);
    expect(patched.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('роль без прав на контент -> 403', async () => {
    const outsider = await adminUser(
      app,
      ['VERIFICATION_OPERATOR'],
      OPERATOR_EMAIL,
    );
    await post(outsider.token, '/v1/admin/content').send(ARTICLE).expect(403);
    await get(outsider.token, '/v1/admin/content').expect(403);
  });

  it('клиентский токен в админский раздел не пускают', async () => {
    const cli = await clientUser(app, PH_C1, () => lastCode);
    // 403 ADMIN_FORBIDDEN, а не 401: токен настоящий и подпись верна, просто
    // он не сотрудника — так ведёт себя AdminJwtGuard во всей админке.
    const res = await get(cli.accessToken, '/v1/admin/content').expect(403);
    expect(res.body.error.code).toBe('ADMIN_FORBIDDEN');

    await request(app.getHttpServer()).get('/v1/admin/content').expect(401);
  });

  it('удаление уносит прогресс и голоса вместе с материалом', async () => {
    const ed = await editor();
    const cli = await clientUser(app, PH_C1, () => lastCode);
    const created = await post(ed.token, '/v1/admin/content')
      .send(ARTICLE)
      .expect(201);
    await patch(ed.token, `/v1/admin/content/${created.body.id}`)
      .send({ published: true })
      .expect(200);

    await post(cli.accessToken, `/v1/content/${created.body.id}/progress`)
      .send({ positionPermille: 500 })
      .expect(200);
    await post(cli.accessToken, `/v1/content/${created.body.id}/vote`)
      .send({ useful: true })
      .expect(200);

    await del(ed.token, `/v1/admin/content/${created.body.id}`).expect(204);

    expect(
      await prisma.contentProgress.count({
        where: { itemId: created.body.id },
      }),
    ).toBe(0);
    expect(
      await prisma.contentVote.count({ where: { itemId: created.body.id } }),
    ).toBe(0);
  });

  it('повторный slug -> 409 CONTENT_SLUG_TAKEN', async () => {
    const ed = await editor();
    await post(ed.token, '/v1/admin/content').send(ARTICLE).expect(201);
    const res = await post(ed.token, '/v1/admin/content')
      .send(ARTICLE)
      .expect(409);
    expect(res.body.error.code).toBe('CONTENT_SLUG_TAKEN');
  });
});
