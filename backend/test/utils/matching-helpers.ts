import { PrismaService } from '../../src/prisma/prisma.service';

// прямые вставки prisma: создаёт по фиктивному Request (клиент - отдельный
// тестовый user по clientPhone) на каждого кандидата с заданными исходами
// (частичный уникальный индекс request_candidates_one_pending_uq допускает
// не более одного PENDING-оффера на заявку). PENDING-офферы не влияют на
// score (окно скоринга — только завершённые), но считаются в tie-break
// «офферы за сегодня».
// opts.offeredAt — момент оффера (по умолчанию сейчас);
// opts.responseDelaySec — respondedAt = offeredAt + delay (по умолчанию 0).
export async function seedCandidateHistory(
  prisma: PrismaService,
  clientPhone: string,
  expertId: string,
  outcomes: {
    accepted?: number;
    declined?: number;
    timeout?: number;
    pending?: number;
  },
  opts: { offeredAt?: Date; responseDelaySec?: number } = {},
): Promise<void> {
  const clientUser = await prisma.user.upsert({
    where: { phone: clientPhone },
    update: {},
    create: { phone: clientPhone, locale: 'ru' },
  });
  const topic = await prisma.topic.findUniqueOrThrow({
    where: { slug: 'anxiety-stress' },
  });
  type SeedResponse = 'ACCEPTED' | 'DECLINED' | 'TIMEOUT' | 'PENDING';
  const responses: SeedResponse[] = [];
  const push = (response: SeedResponse, count: number) => {
    for (let i = 0; i < count; i++) responses.push(response);
  };
  push('ACCEPTED', outcomes.accepted ?? 0);
  push('DECLINED', outcomes.declined ?? 0);
  push('TIMEOUT', outcomes.timeout ?? 0);
  push('PENDING', outcomes.pending ?? 0);

  const offeredAt = opts.offeredAt ?? new Date();
  const respondedAt = new Date(
    offeredAt.getTime() + (opts.responseDelaySec ?? 0) * 1000,
  );

  // Отдельная заявка на каждого кандидата — иначе несколько PENDING одной
  // заявки нарушат request_candidates_one_pending_uq.
  for (const response of responses) {
    const req = await prisma.request.create({
      data: {
        clientUserId: clientUser.id,
        clientCode: 9999,
        topicId: topic.id,
        format: 'video',
      },
    });
    await prisma.requestCandidate.create({
      data: {
        requestId: req.id,
        expertId,
        offeredAt,
        deadlineAt: new Date(offeredAt.getTime() + 30_000),
        respondedAt:
          response === 'ACCEPTED' || response === 'DECLINED'
            ? respondedAt
            : null,
        response,
      },
    });
  }
}
