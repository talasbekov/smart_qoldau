import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProfileFieldStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProfileModerationService } from '../src/experts/profile-moderation.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { registeredExpertUser } from './utils/expert-helpers';

// Текст «о себе» (E2a, задача 4). Публичный контент, поэтому идёт на
// проверку; опубликованное значение продолжает работать, пока новое
// проверяется (Р-18).
const PH_E1 = '+77098300001';
const TEXT =
  'Работаю с тревогой и выгоранием, опираюсь на КПТ и схема-терапию.';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    if (match) lastCode = match[1];
  }
}

describe('Текст «о себе» специалиста (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let moderation: ProfileModerationService;
  let accessToken: string;
  let expertId: string;

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: PH_E1 },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (!ids.length) return;
    const experts = await prisma.expert.findMany({
      where: { userId: { in: ids } },
      select: { id: true },
    });
    const expertIds = experts.map((e) => e.id);
    await prisma.expertTopic.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expert.deleteMany({ where: { id: { in: expertIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.smsCode.deleteMany({ where: { phone: PH_E1 } });
  }

  const patch = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .patch('/v1/experts/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(body);

  const expert = () =>
    prisma.expert.findUniqueOrThrow({ where: { id: expertId } });

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    moderation = app.get(ProfileModerationService);
    await cleanup();
    const registered = await registeredExpertUser(app, PH_E1, () => lastCode);
    accessToken = registered.accessToken;
    expertId = registered.expertId;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('текст кладётся в aboutPending и не трогает опубликованный', async () => {
    await prisma.expert.update({
      where: { id: expertId },
      data: { about: 'Прежний текст', aboutStatus: 'APPROVED' },
    });

    await patch({ about: TEXT }).expect(200);

    const after = await expert();
    expect(after.aboutPending).toBe(TEXT);
    expect(after.about).toBe('Прежний текст');
    expect(after.aboutStatus).toBe(ProfileFieldStatus.PENDING);
  });

  it('ответ PATCH отдаёт опубликованный текст, а не тот, что на проверке', async () => {
    const res = await patch({ city: 'Астана' }).expect(200);
    expect(res.body.about).toBe('Прежний текст');
    expect(res.body.aboutStatus).toBe(ProfileFieldStatus.PENDING);
  });

  it('слишком короткий, слишком длинный и пробельный текст отклоняются', async () => {
    await patch({ about: 'Пять!' }).expect(400);
    await patch({ about: 'я'.repeat(1001) }).expect(400);
    await patch({ about: '          ' }).expect(400);

    const after = await expert();
    expect(after.aboutPending).toBe(TEXT);
  });

  it('пустая строка снимает и опубликованный текст, и тот, что на проверке', async () => {
    await patch({ about: '' }).expect(200);

    const after = await expert();
    expect(after.about).toBeNull();
    expect(after.aboutPending).toBeNull();
    expect(after.aboutStatus).toBe(ProfileFieldStatus.NONE);
  });

  it('смена города ничего не ставит на модерацию', async () => {
    await patch({ city: 'Шымкент' }).expect(200);
    const after = await expert();
    expect(after.aboutStatus).toBe(ProfileFieldStatus.NONE);
    expect(after.photoStatus).toBe(ProfileFieldStatus.NONE);
  });

  it('решение поверх незакоммиченного чужого решения не проходит', async () => {
    await patch({ about: TEXT }).expect(200);

    // Детерминированная гонка: первый оператор уже одобрил текст, но его
    // транзакция ещё не закоммичена. Второй обязан дождаться блокировки и
    // увидеть новый статус, а не перезаписать решение по прочитанному
    // раньше снимку (урок финального ревью E8a).
    const firstCommitted = { value: false };
    const first = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM experts WHERE id = ${expertId} FOR UPDATE`;
      await tx.expert.update({
        where: { id: expertId },
        data: {
          about: TEXT,
          aboutPending: null,
          aboutStatus: ProfileFieldStatus.APPROVED,
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 300));
      firstCommitted.value = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    const second = moderation
      .reject(expertId, 'about', 'admin-2', 'Слишком общо')
      .then(
        () => 'ok' as const,
        (error: { getStatus?: () => number }) => error.getStatus?.() ?? 500,
      );

    const [, outcome] = await Promise.all([first, second]);
    // Второй дождался коммита первого — иначе он решал бы по устаревшему
    // снимку.
    expect(firstCommitted.value).toBe(true);
    expect(outcome).toBe(409);

    const after = await expert();
    expect(after.aboutStatus).toBe(ProfileFieldStatus.APPROVED);
    expect(after.about).toBe(TEXT);
    expect(after.moderationComment).toBeNull();
  });
});
