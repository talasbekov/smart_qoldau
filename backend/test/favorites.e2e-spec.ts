import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { clientUser, guestClient } from './utils/client-helpers';
import { acceptingExpert, verifiedExpert } from './utils/expert-helpers';

const ADMIN = { 'X-Admin-Token': 'dev-admin-token-0123456789abcdef' };

// Номера/deviceId спека задачи 8 (E3, Избранное), не пересекаются с другими
// спеками.
const PHONE_CLIENT = '+77084000001';
const PHONE_EXPERT1 = '+77084000010';
const PHONE_EXPERT2 = '+77084000011';
const ALL_PHONES = [PHONE_CLIENT, PHONE_EXPERT1, PHONE_EXPERT2];
const GUEST_DEVICE = 'favorites-guest-dev-1';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{4})/);
    lastCode = match ? match[1] : '';
  }
}

function codeGetter() {
  return lastCode;
}

describe('Favorites (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function cleanup() {
    // Гостевой клиент спека не имеет телефона — ищем и по deviceId.
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { phone: { in: ALL_PHONES } },
          { deviceId: GUEST_DEVICE, isGuest: true },
        ],
      },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const experts = await prisma.expert.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    const expertIds = experts.map((e) => e.id);
    // Favorite без FK: чистим и по userId своих клиентов, и по expertId
    // своих экспертов (на случай чужих ссылок на них).
    await prisma.favorite.deleteMany({
      where: {
        OR: [{ userId: { in: userIds } }, { expertId: { in: expertIds } }],
      },
    });
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
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.smsCode.deleteMany({ where: { phone: { in: ALL_PHONES } } });
    await prisma.auditLog.deleteMany({
      where: { entityId: { in: [...userIds, ...expertIds] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
  });

  // Финальная чистка обязательна: спек создаёт ACCEPTING-экспертов с
  // расписанием 24/7 и общими топиками — оставшись в БД, они перехватывали бы
  // офферы в следующих сьютах (requests-flow и др.).
  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  beforeEach(async () => {
    await cleanup();
  });

  describe('PUT /v1/favorites/:expertId', () => {
    it('добавляет эксперта в избранное и возвращает 204', async () => {
      // Arrange: создаём VERIFIED эксперта
      const { expertId } = await acceptingExpert(
        app,
        PHONE_EXPERT1,
        codeGetter,
      );

      // Arrange: создаём обычного клиента
      const { accessToken, userId } = await clientUser(
        app,
        PHONE_CLIENT,
        codeGetter,
      );

      // Act: добавляем эксперта в избранное
      await request(app.getHttpServer())
        .put(`/v1/favorites/${expertId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Assert: проверяем, что запись создана в БД
      const favorite = await prisma.favorite.findUnique({
        where: { userId_expertId: { userId, expertId } },
      });
      expect(favorite).toBeDefined();
      expect(favorite?.createdAt).toBeDefined();
    });

    it('идемпотентно: повторный PUT не падает', async () => {
      const { expertId } = await acceptingExpert(
        app,
        PHONE_EXPERT1,
        codeGetter,
      );
      const { accessToken } = await clientUser(app, PHONE_CLIENT, codeGetter);

      // Act: первый PUT
      await request(app.getHttpServer())
        .put(`/v1/favorites/${expertId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Act: второй PUT
      await request(app.getHttpServer())
        .put(`/v1/favorites/${expertId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });

    it('гостевой клиент может добавлять в избранное', async () => {
      const { expertId } = await acceptingExpert(
        app,
        PHONE_EXPERT1,
        codeGetter,
      );
      const { accessToken } = await guestClient(app, GUEST_DEVICE);

      await request(app.getHttpServer())
        .put(`/v1/favorites/${expertId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });

    it('DRAFT-эксперт возвращает 404 EXPERT_NOT_FOUND', async () => {
      // Arrange: создаём эксперта в DRAFT (он ещё не VERIFIED)
      const { expertId } = await verifiedExpert(
        app,
        PHONE_EXPERT1,
        codeGetter,
        {},
      );
      // Откатываем его в DRAFT
      await prisma.expert.update({
        where: { id: expertId },
        data: { verificationStatus: 'DRAFT' },
      });

      const { accessToken } = await clientUser(app, PHONE_CLIENT, codeGetter);

      // Act & Assert
      await request(app.getHttpServer())
        .put(`/v1/favorites/${expertId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404)
        .then((res) => {
          expect(res.body.error.code).toBe('EXPERT_NOT_FOUND');
        });
    });

    it('заблокированный эксперт возвращает 404 EXPERT_NOT_FOUND', async () => {
      const { expertId } = await acceptingExpert(
        app,
        PHONE_EXPERT1,
        codeGetter,
      );
      const { accessToken } = await clientUser(app, PHONE_CLIENT, codeGetter);

      // Arrange: блокируем эксперта
      await request(app.getHttpServer())
        .post(`/v1/admin/experts/${expertId}/block`)
        .set(ADMIN)
        .send({ reason: 'Тестовая блокировка' })
        .expect(200);

      // Act & Assert
      await request(app.getHttpServer())
        .put(`/v1/favorites/${expertId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404)
        .then((res) => {
          expect(res.body.error.code).toBe('EXPERT_NOT_FOUND');
        });
    });

    it('невалидный UUID возвращает 400', async () => {
      const { accessToken } = await clientUser(app, PHONE_CLIENT, codeGetter);

      await request(app.getHttpServer())
        .put(`/v1/favorites/not-a-uuid`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('DELETE /v1/favorites/:expertId', () => {
    it('удаляет эксперта из избранного и возвращает 204', async () => {
      const { expertId } = await acceptingExpert(
        app,
        PHONE_EXPERT1,
        codeGetter,
      );
      const { accessToken, userId } = await clientUser(
        app,
        PHONE_CLIENT,
        codeGetter,
      );

      // Arrange: добавляем в избранное
      await request(app.getHttpServer())
        .put(`/v1/favorites/${expertId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Act: удаляем
      await request(app.getHttpServer())
        .delete(`/v1/favorites/${expertId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Assert: проверяем удаление
      const favorite = await prisma.favorite.findUnique({
        where: { userId_expertId: { userId, expertId } },
      });
      expect(favorite).toBeNull();
    });

    it('идемпотентно: удаление несуществующей записи не падает', async () => {
      const { expertId } = await acceptingExpert(
        app,
        PHONE_EXPERT1,
        codeGetter,
      );
      const { accessToken } = await clientUser(app, PHONE_CLIENT, codeGetter);

      // Act & Assert: удаление несуществующей записи
      await request(app.getHttpServer())
        .delete(`/v1/favorites/${expertId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
    });
  });

  describe('GET /v1/favorites', () => {
    it('возвращает массив избранных экспертов', async () => {
      // Arrange: создаём двух VERIFIED экспертов
      const { expertId: id1 } = await acceptingExpert(
        app,
        PHONE_EXPERT1,
        codeGetter,
      );
      const { expertId: id2 } = await acceptingExpert(
        app,
        PHONE_EXPERT2,
        codeGetter,
      );

      const { accessToken } = await clientUser(app, PHONE_CLIENT, codeGetter);

      // Arrange: добавляем обоих в избранное
      await request(app.getHttpServer())
        .put(`/v1/favorites/${id1}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);
      await request(app.getHttpServer())
        .put(`/v1/favorites/${id2}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Act
      const res = await request(app.getHttpServer())
        .get('/v1/favorites')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Assert
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('displayName');
      expect(res.body[0]).toHaveProperty('city');
      expect(res.body[0]).toHaveProperty('priceTiyn');
      expect(res.body[0]).not.toHaveProperty('userId');
      expect(res.body[0]).not.toHaveProperty('phone');
    });

    it('гостевой клиент может получить избранное', async () => {
      const { expertId } = await acceptingExpert(
        app,
        PHONE_EXPERT1,
        codeGetter,
      );
      const { accessToken } = await guestClient(app, GUEST_DEVICE);

      await request(app.getHttpServer())
        .put(`/v1/favorites/${expertId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .get('/v1/favorites')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(expertId);
    });

    it('возвращает пустой массив если избранное пусто', async () => {
      const { accessToken } = await clientUser(app, PHONE_CLIENT, codeGetter);

      const res = await request(app.getHttpServer())
        .get('/v1/favorites')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('заблокированный эксперт не отображается, но связка остаётся', async () => {
      const { expertId } = await acceptingExpert(
        app,
        PHONE_EXPERT1,
        codeGetter,
      );
      const { accessToken, userId } = await clientUser(
        app,
        PHONE_CLIENT,
        codeGetter,
      );

      // Arrange: добавляем в избранное
      await request(app.getHttpServer())
        .put(`/v1/favorites/${expertId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Arrange: блокируем эксперта
      await request(app.getHttpServer())
        .post(`/v1/admin/experts/${expertId}/block`)
        .set(ADMIN)
        .send({ reason: 'Тестовая блокировка' })
        .expect(200);

      // Act: получаем избранное
      const res = await request(app.getHttpServer())
        .get('/v1/favorites')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Assert: заблокированный эксперт не отображается
      expect(res.body).toHaveLength(0);

      // Assert: но связка остаётся в БД
      const favorite = await prisma.favorite.findUnique({
        where: { userId_expertId: { userId, expertId } },
      });
      expect(favorite).toBeDefined();
    });

    it('сортирует по createdAt избранного в обратном порядке (новые первыми)', async () => {
      const { expertId: id1 } = await acceptingExpert(
        app,
        PHONE_EXPERT1,
        codeGetter,
      );
      const { expertId: id2 } = await acceptingExpert(
        app,
        PHONE_EXPERT2,
        codeGetter,
      );

      const { accessToken } = await clientUser(app, PHONE_CLIENT, codeGetter);

      // Arrange: добавляем первого, ждём, добавляем второго
      await request(app.getHttpServer())
        .put(`/v1/favorites/${id1}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Ждём чтобы гарантировать разные createdAt
      await new Promise((resolve) => setTimeout(resolve, 10));

      await request(app.getHttpServer())
        .put(`/v1/favorites/${id2}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      // Act
      const res = await request(app.getHttpServer())
        .get('/v1/favorites')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Assert: второй должен быть первым (новые первыми)
      expect(res.body[0].id).toBe(id2);
      expect(res.body[1].id).toBe(id1);
    });

    it('не раскрывает PII (userId, phone, верификационный статус)', async () => {
      const { expertId } = await acceptingExpert(
        app,
        PHONE_EXPERT1,
        codeGetter,
      );
      const { accessToken } = await clientUser(app, PHONE_CLIENT, codeGetter);

      await request(app.getHttpServer())
        .put(`/v1/favorites/${expertId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .get('/v1/favorites')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const expert = res.body[0];
      expect(expert).not.toHaveProperty('userId');
      expect(expert).not.toHaveProperty('phone');
      expect(expert).not.toHaveProperty('verificationStatus');
      expect(expert).not.toHaveProperty('isBlocked');
      expect(expert).not.toHaveProperty('education');
      expect(expert).not.toHaveProperty('blockedReason');
      // Чувствительные номера должны быть недоступны
      const json = JSON.stringify(expert);
      expect(json).not.toMatch(/\+77\d{9}/);
    });
  });

  describe('Authorization', () => {
    it('требует JWT токен', async () => {
      const { expertId } = await acceptingExpert(
        app,
        PHONE_EXPERT1,
        codeGetter,
      );

      // PUT без токена
      await request(app.getHttpServer())
        .put(`/v1/favorites/${expertId}`)
        .expect(401);

      // DELETE без токена
      await request(app.getHttpServer())
        .delete(`/v1/favorites/${expertId}`)
        .expect(401);

      // GET без токена
      await request(app.getHttpServer()).get('/v1/favorites').expect(401);
    });
  });
});
