import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { adminUser } from './utils/admin-helpers';
import { clientUser } from './utils/client-helpers';

const SLUG_PREFIX = 'e2e-cms-';
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
  category: 'anxiety',
  titleRu: 'Как справиться с тревогой',
  titleKk: 'Мазасыздық',
  summaryRu: 'Кратко',
  summaryKk: 'Қысқаша',
  payload: { markdownRu: '# Привет', markdownKk: '# Сәлем' },
  sortOrder: 10,
};

describe('Контент: CMS редактора (E13, e2e)', () => {
  let prisma: PrismaService;

  async function cleanup() {
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
  });

  beforeEach(() => cleanup());

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  function editor() {
    return adminUser(app, ['CONTENT_EDITOR'], EDITOR_EMAIL);
  }

  it('редактор создаёт черновик, публикует и снимает с публикации', async () => {
    const ed = await editor();
    const cli = await clientUser(app, PH_C1, () => lastCode);

    const created = await post(ed.token, '/v1/admin/content')
      .send(ARTICLE)
      .expect(201);
    expect(created.body.publishedAt).toBeNull();
    // Черновик клиенту не виден — редактор готовит его сколько нужно.
    expect(
      (await get(cli.accessToken, '/v1/content').expect(200)).body,
    ).toHaveLength(0);

    await patch(ed.token, `/v1/admin/content/${created.body.id}`)
      .send({ published: true })
      .expect(200);
    expect(
      (await get(cli.accessToken, '/v1/content').expect(200)).body,
    ).toHaveLength(1);

    await patch(ed.token, `/v1/admin/content/${created.body.id}`)
      .send({ published: false })
      .expect(200);
    expect(
      (await get(cli.accessToken, '/v1/content').expect(200)).body,
    ).toHaveLength(0);
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

    const wrongAudio = await post(ed.token, '/v1/admin/content')
      .send({
        ...ARTICLE,
        kind: 'MEDITATION',
        slug: `${SLUG_PREFIX}meditation`,
        payload: {},
      })
      .expect(400);
    expect(wrongAudio.body.error.code).toBe('VALIDATION_FAILED');
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
