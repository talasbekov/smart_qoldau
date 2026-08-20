import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

describe('Prisma Consultation schema', () => {
  const s = new PrismaService();
  beforeAll(() => s.$connect());
  afterAll(() => s.$disconnect());

  it('консультация создаётся с уникальным requestId, хранит зашифрованные сообщения/заметки и уникальный отзыв', async () => {
    const topic = await s.topic.findUniqueOrThrow({
      where: { slug: 'anxiety-stress' },
    });
    const user = await s.user.create({ data: { phone: '+77070000003' } });
    const expertUser = await s.user.create({ data: { phone: '+77070000004' } });
    const expert = await s.expert.create({
      data: {
        userId: expertUser.id,
        displayName: 'Тестовый эксперт',
        city: 'Алматы',
        experience: 'ONE_TO_THREE',
        education: 'Образование',
        priceTiyn: 500000,
        languages: ['ru'],
        formats: ['chat'],
      },
    });

    const now = new Date();
    const consultation = await s.consultation.create({
      data: {
        requestId: 'req-uniq-1',
        clientUserId: user.id,
        clientCode: 1234,
        expertId: expert.id,
        topicId: topic.id,
        format: 'chat',
        priceTiyn: 500000,
        startedAt: now,
      },
    });

    expect(consultation.status).toBe('ACTIVE');
    expect(consultation.isEmergency).toBe(false);
    expect(consultation.plannedDurationMin).toBe(50);

    // requestId уникален — повторный create с тем же requestId падает P2002
    await expect(
      s.consultation.create({
        data: {
          requestId: 'req-uniq-1',
          clientUserId: user.id,
          clientCode: 5678,
          expertId: expert.id,
          topicId: topic.id,
          format: 'chat',
          priceTiyn: 500000,
          startedAt: now,
        },
      }),
    ).rejects.toMatchObject({
      code: 'P2002',
    } as Partial<Prisma.PrismaClientKnownRequestError>);

    // ChatMessage: Bytes-поле
    const ciphertext = Buffer.from('iv+tag+data-stub');
    const message = await s.chatMessage.create({
      data: {
        consultationId: consultation.id,
        senderRole: 'client',
        ciphertext,
      },
    });
    expect(message.ciphertext).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(message.ciphertext).equals(ciphertext)).toBe(true);

    const note = await s.expertNote.create({
      data: {
        consultationId: consultation.id,
        expertId: expert.id,
        ciphertext: Buffer.from('note-stub'),
      },
    });
    expect(note.ciphertext).toBeInstanceOf(Uint8Array);

    const review = await s.review.create({
      data: {
        consultationId: consultation.id,
        clientUserId: user.id,
        expertId: expert.id,
        rating: 5,
        publicText: 'Отлично помогли',
      },
    });
    expect(review.status).toBe('PUBLISHED');

    // Review уникален по consultationId
    await expect(
      s.review.create({
        data: {
          consultationId: consultation.id,
          clientUserId: user.id,
          expertId: expert.id,
          rating: 4,
        },
      }),
    ).rejects.toMatchObject({
      code: 'P2002',
    } as Partial<Prisma.PrismaClientKnownRequestError>);

    // очистка: review → note → messages → consultation; затем user/expert
    await s.review.delete({ where: { id: review.id } });
    await s.expertNote.delete({ where: { consultationId: consultation.id } });
    await s.chatMessage.delete({ where: { id: message.id } });
    await s.consultation.delete({ where: { id: consultation.id } });
    await s.expert.delete({ where: { id: expert.id } });
    await s.user.delete({ where: { id: expertUser.id } });
    await s.user.delete({ where: { id: user.id } });
  });
});
