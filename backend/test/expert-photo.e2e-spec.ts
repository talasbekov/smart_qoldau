import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StorageService } from '../src/storage/storage.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { registeredExpertUser } from './utils/expert-helpers';

// Загрузка фотографии специалиста (E2a, задача 3). Тип определяется по
// фактическому содержимому, а не по расширению и не по Content-Type:
// подделываются оба. EXIF срезается — метаданные снимка содержат
// геолокацию и модель устройства, публиковать их нельзя.
const PH_E1 = '+77098200001';
const PH_E2 = '+77098200002';
const ALL_PHONES = [PH_E1, PH_E2];

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    if (match) lastCode = match[1];
  }
}

const jpeg = (width: number, height: number) =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 90, b: 160 },
    },
  })
    .jpeg()
    .toBuffer();

describe('Фотография специалиста (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: StorageService;

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { phone: { in: ALL_PHONES } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (!ids.length) return;
    const experts = await prisma.expert.findMany({
      where: { userId: { in: ids } },
      select: { id: true },
    });
    const expertIds = experts.map((e) => e.id);
    await prisma.expertDocument.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expertTopic.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expertScheduleDay.deleteMany({
      where: { expertId: { in: expertIds } },
    });
    await prisma.expert.deleteMany({ where: { id: { in: expertIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
  }

  const photoOf = (expertId: string) =>
    prisma.expert.findUniqueOrThrow({ where: { id: expertId } });

  const exists = async (key: string) =>
    (await fetch(storage.avatarUrl(key))).status === 200;

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    storage = app.get(StorageService);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('валидный jpeg → 202 PENDING, объект в бакете аватаров, опубликованное фото не тронуто', async () => {
    const { accessToken, expertId } = await registeredExpertUser(
      app,
      PH_E1,
      () => lastCode,
    );
    // Уже опубликованное фото: загрузка нового его не трогает (Р-18).
    await prisma.expert.update({
      where: { id: expertId },
      data: { photoKey: 'published.webp', photoStatus: 'APPROVED' },
    });

    const res = await request(app.getHttpServer())
      .post('/v1/experts/me/photo')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', await jpeg(800, 800), 'photo.jpg')
      .expect(202);
    expect(res.body).toEqual({ status: 'PENDING' });

    const expert = await photoOf(expertId);
    expect(expert.photoStatus).toBe('PENDING');
    expect(expert.photoKey).toBe('published.webp');
    expect(expert.photoPendingKey).toMatch(
      /^[0-9a-f-]{36}\.webp$/, // UUID v4, не производная от id специалиста
    );
    expect(await exists(expert.photoPendingKey!)).toBe(true);
  });

  it('фото нормализуется в квадрат 512×512 webp без EXIF', async () => {
    const expert = await prisma.expert.findFirstOrThrow({
      where: { user: { phone: PH_E1 } },
    });
    const stored = await fetch(storage.avatarUrl(expert.photoPendingKey!));
    const meta = await sharp(
      Buffer.from(await stored.arrayBuffer()),
    ).metadata();

    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
    expect(meta.exif).toBeUndefined();
  });

  it('EXIF с координатами не переживает загрузку', async () => {
    const { accessToken } = await registeredExpertUser(
      app,
      PH_E2,
      () => lastCode,
    );
    const withExif = await sharp({
      create: {
        width: 600,
        height: 600,
        channels: 3,
        background: { r: 10, g: 10, b: 10 },
      },
    })
      // Модель устройства и координаты снимка — ровно то, ради чего EXIF
      // и срезается. Типы sharp знают только IFD-каталоги, GPS кладётся
      // тем же способом, что и остальные теги.
      .withExif({
        IFD0: { Model: 'Pixel 8', Make: 'Google' },
        IFD2: { GPSLatitude: '43/1 15/1 0/1', GPSLatitudeRef: 'N' },
      })
      .jpeg()
      .toBuffer();
    // Исходник действительно несёт EXIF — иначе проверка ниже пуста.
    expect((await sharp(withExif).metadata()).exif).toBeDefined();

    await request(app.getHttpServer())
      .post('/v1/experts/me/photo')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('file', withExif, 'photo.jpg')
      .expect(202);

    const expert = await prisma.expert.findFirstOrThrow({
      where: { user: { phone: PH_E2 } },
    });
    const stored = await fetch(storage.avatarUrl(expert.photoPendingKey!));
    const meta = await sharp(
      Buffer.from(await stored.arrayBuffer()),
    ).metadata();
    expect(meta.exif).toBeUndefined();
  });

  it('повторная загрузка заменяет pending и удаляет прежний объект', async () => {
    const expert = await prisma.expert.findFirstOrThrow({
      where: { user: { phone: PH_E2 } },
    });
    const previousKey = expert.photoPendingKey!;
    const { accessToken } = await registeredExpertUser(
      app,
      PH_E2,
      () => lastCode,
    ).catch(() => ({ accessToken: '' }));
    void accessToken;

    const token = await (async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/request-code')
        .send({ phone: PH_E2 })
        .expect(204);
      const verify = await request(app.getHttpServer())
        .post('/v1/auth/verify-code')
        .send({ phone: PH_E2, code: lastCode })
        .expect(200);
      return verify.body.accessToken as string;
    })();

    await request(app.getHttpServer())
      .post('/v1/experts/me/photo')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', await jpeg(700, 700), 'photo.jpg')
      .expect(202);

    const updated = await photoOf(expert.id);
    expect(updated.photoPendingKey).not.toBe(previousKey);
    // Мусор в хранилище не копится.
    expect(await exists(previousKey)).toBe(false);
    expect(await exists(updated.photoPendingKey!)).toBe(true);
  });

  describe('отказы валидации', () => {
    let token: string;

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/v1/auth/request-code')
        .send({ phone: PH_E1 })
        .expect(204);
      const verify = await request(app.getHttpServer())
        .post('/v1/auth/verify-code')
        .send({ phone: PH_E1, code: lastCode })
        .expect(200);
      token = verify.body.accessToken;
    });

    const post = (body: Buffer, name = 'photo.jpg') =>
      request(app.getHttpServer())
        .post('/v1/experts/me/photo')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', body, name);

    it('расширение .jpg при содержимом не-изображения → 400 PHOTO_INVALID', async () => {
      const res = await post(Buffer.from('это просто текст'), 'photo.jpg');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PHOTO_INVALID');
    });

    it('файл больше 5 МБ → 400', async () => {
      const big = Buffer.alloc(6 * 1024 * 1024, 1);
      expect((await post(big)).status).toBe(400);
    });

    it('сторона меньше 200 px → 400 PHOTO_INVALID', async () => {
      const res = await post(await jpeg(100, 100));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PHOTO_INVALID');
    });

    it('соотношение сторон вне 1:2..2:1 → 400 PHOTO_INVALID', async () => {
      const res = await post(await jpeg(300, 1000));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PHOTO_INVALID');
    });

    it('без токена → 401', async () => {
      await request(app.getHttpServer())
        .post('/v1/experts/me/photo')
        .attach('file', await jpeg(600, 600), 'photo.jpg')
        .expect(401);
    });
  });

  it('GET /v1/experts/me показывает статус фото и причину отказа', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone: PH_E1 })
      .expect(204);
    const verify = await request(app.getHttpServer())
      .post('/v1/auth/verify-code')
      .send({ phone: PH_E1, code: lastCode })
      .expect(200);
    const token = verify.body.accessToken;

    const me = await request(app.getHttpServer())
      .get('/v1/experts/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.photoStatus).toBe('PENDING');
    expect(me.body.photoUrl).toContain('published.webp');
    expect(me.body.moderationComment).toBeNull();
  });

  it('DELETE снимает и опубликованное, и проверяемое фото', async () => {
    const expert = await prisma.expert.findFirstOrThrow({
      where: { user: { phone: PH_E1 } },
    });
    const pendingKey = expert.photoPendingKey!;

    await request(app.getHttpServer())
      .post('/v1/auth/request-code')
      .send({ phone: PH_E1 })
      .expect(204);
    const verify = await request(app.getHttpServer())
      .post('/v1/auth/verify-code')
      .send({ phone: PH_E1, code: lastCode })
      .expect(200);

    await request(app.getHttpServer())
      .delete('/v1/experts/me/photo')
      .set('Authorization', `Bearer ${verify.body.accessToken}`)
      .expect(204);

    const after = await photoOf(expert.id);
    expect(after.photoKey).toBeNull();
    expect(after.photoPendingKey).toBeNull();
    expect(after.photoStatus).toBe('NONE');
    expect(await exists(pendingKey)).toBe(false);
  });
});
