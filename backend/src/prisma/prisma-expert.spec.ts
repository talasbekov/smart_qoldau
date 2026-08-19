import { PrismaService } from './prisma.service';

describe('Prisma Expert schema', () => {
  const s = new PrismaService();
  beforeAll(() => s.$connect());
  afterAll(() => s.$disconnect());

  it('эксперт создаётся с дефолтами DRAFT/NOT_ACCEPTING и удаляется', async () => {
    const user = await s.user.create({ data: { phone: '+77070000001' } });
    const expert = await s.expert.create({
      data: {
        userId: user.id,
        displayName: 'Тест Эксперт',
        city: 'Астана',
        experience: 'FIVE_TO_TEN',
        education: 'КазНУ',
        priceTiyn: 399000,
        languages: ['ru', 'kz'],
        formats: ['chat', 'video'],
      },
    });
    expect(expert.verificationStatus).toBe('DRAFT');
    expect(expert.workStatus).toBe('NOT_ACCEPTING');
    expect(expert.isBlocked).toBe(false);
    await s.expert.delete({ where: { id: expert.id } });
    await s.user.delete({ where: { id: user.id } });
  });
});
