import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('подключается и считает пользователей', async () => {
    const s = new PrismaService();
    await s.$connect();
    expect(typeof (await s.user.count())).toBe('number');
    await s.$disconnect();
  });
});
