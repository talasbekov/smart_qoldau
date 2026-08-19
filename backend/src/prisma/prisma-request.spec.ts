import { PrismaService } from './prisma.service';

describe('Prisma Request schema', () => {
  const s = new PrismaService();
  beforeAll(() => s.$connect());
  afterAll(() => s.$disconnect());

  it('заявка создаётся со связанным Topic и кандидатом PENDING, читается каскадно и удаляется', async () => {
    const topic = await s.topic.findUniqueOrThrow({
      where: { slug: 'anxiety-stress' },
    });
    const user = await s.user.create({ data: { phone: '+77070000002' } });

    const now = new Date();
    const request = await s.request.create({
      data: {
        clientUserId: user.id,
        clientCode: 1234,
        topicId: topic.id,
        format: 'chat',
      },
    });

    expect(request.status).toBe('SEARCHING');
    expect(request.isEmergency).toBe(false);

    const candidate = await s.requestCandidate.create({
      data: {
        requestId: request.id,
        expertId: 'expert-stub-id',
        offeredAt: now,
        deadlineAt: new Date(now.getTime() + 60_000),
      },
    });

    expect(candidate.response).toBe('PENDING');

    const withCandidates = await s.request.findUniqueOrThrow({
      where: { id: request.id },
      include: { candidates: true, topic: true },
    });

    expect(withCandidates.topic.slug).toBe('anxiety-stress');
    expect(withCandidates.candidates).toHaveLength(1);
    expect(withCandidates.candidates[0].id).toBe(candidate.id);

    await s.requestCandidate.delete({ where: { id: candidate.id } });
    await s.request.delete({ where: { id: request.id } });
    await s.user.delete({ where: { id: user.id } });
  });
});
