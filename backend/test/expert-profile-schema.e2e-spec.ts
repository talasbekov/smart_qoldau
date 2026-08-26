import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../src/auth/sms/sms.provider';
import { createApp } from './utils/create-app';
import { registeredExpertUser } from './utils/expert-helpers';

// Схема модерируемых полей профиля (E2a, задача 1). Разделение
// опубликованного и проверяемого значения — прямое следствие Р-18: пока
// новое фото или текст проверяются, профиль работает со старыми.
const PH_E1 = '+77098100001';

let lastCode = '';

class FakeSmsProvider implements SmsProvider {
  async send(_phone: string, text: string): Promise<void> {
    const match = text.match(/(\d{6})/);
    if (match) lastCode = match[1];
  }
}

describe('Схема публичного профиля специалиста (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
    await prisma.review.deleteMany({ where: { expertId: { in: expertIds } } });
    await prisma.consultation.deleteMany({
      where: { expertId: { in: expertIds } },
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
    await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.smsCode.deleteMany({ where: { phone: PH_E1 } });
  }

  beforeAll(async () => {
    app = await createApp(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(SMS_PROVIDER_TOKEN)
        .useClass(FakeSmsProvider),
    );
    prisma = app.get(PrismaService);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('новый специалист создаётся без фото и без текста: статусы NONE', async () => {
    const { expertId } = await registeredExpertUser(app, PH_E1, () => lastCode);
    const expert = await prisma.expert.findUniqueOrThrow({
      where: { id: expertId },
    });
    expect(expert.photoStatus).toBe('NONE');
    expect(expert.aboutStatus).toBe('NONE');
    expect(expert.photoKey).toBeNull();
    expect(expert.photoPendingKey).toBeNull();
    expect(expert.about).toBeNull();
    expect(expert.aboutPending).toBeNull();
    expect(expert.moderationComment).toBeNull();
  });

  it('значение на проверке не трогает опубликованное', async () => {
    const expert = await prisma.expert.findFirstOrThrow({
      where: { user: { phone: PH_E1 } },
    });
    await prisma.expert.update({
      where: { id: expert.id },
      data: {
        photoKey: 'published-key',
        about: 'Опубликованный текст о себе',
        photoStatus: 'APPROVED',
        aboutStatus: 'APPROVED',
      },
    });

    const updated = await prisma.expert.update({
      where: { id: expert.id },
      data: {
        photoPendingKey: 'pending-key',
        aboutPending: 'Новый текст на проверке',
        photoStatus: 'PENDING',
        aboutStatus: 'PENDING',
      },
    });

    expect(updated.photoKey).toBe('published-key');
    expect(updated.about).toBe('Опубликованный текст о себе');
    expect(updated.photoPendingKey).toBe('pending-key');
    expect(updated.aboutPending).toBe('Новый текст на проверке');
  });

  it('отзыв хранит массив кодов тегов и читается обратно', async () => {
    const expert = await prisma.expert.findFirstOrThrow({
      where: { user: { phone: PH_E1 } },
    });
    const topic = await prisma.topic.findFirstOrThrow();
    const consultation = await prisma.consultation.create({
      data: {
        requestId: `schema-e2e-req-${expert.id}`,
        clientUserId: expert.userId,
        clientCode: 1234,
        expertId: expert.id,
        topicId: topic.id,
        format: 'chat',
        priceTiyn: 399000,
        startedAt: new Date(),
      },
    });
    const created = await prisma.review.create({
      data: {
        consultationId: consultation.id,
        clientUserId: expert.userId,
        expertId: expert.id,
        rating: 5,
        tags: ['attentive', 'exceeded_expectations'],
      },
    });
    const read = await prisma.review.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(read.tags).toEqual(['attentive', 'exceeded_expectations']);

    const second = await prisma.consultation.create({
      data: {
        requestId: `schema-e2e-req2-${expert.id}`,
        clientUserId: expert.userId,
        clientCode: 4321,
        expertId: expert.id,
        topicId: topic.id,
        format: 'chat',
        priceTiyn: 399000,
        startedAt: new Date(),
      },
    });
    const withoutTags = await prisma.review.create({
      data: {
        consultationId: second.id,
        clientUserId: expert.userId,
        expertId: expert.id,
        rating: 4,
      },
    });
    expect(withoutTags.tags).toEqual([]);
  });
});
