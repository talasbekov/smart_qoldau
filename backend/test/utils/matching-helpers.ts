import { PrismaService } from '../../src/prisma/prisma.service';

// прямые вставки prisma: создаёт фиктивный Request (клиент - отдельный
// тестовый user по clientPhone) и вешает на него N кандидатов с заданными
// исходами. PENDING-офферы не влияют на score (окно скоринга — только
// завершённые), но считаются в tie-break «офферы за сегодня».
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
  const req = await prisma.request.create({
    data: {
      clientUserId: clientUser.id,
      clientCode: 9999,
      topicId: topic.id,
      format: 'video',
    },
  });

  type SeedResponse = 'ACCEPTED' | 'DECLINED' | 'TIMEOUT' | 'PENDING';
  const rows: {
    requestId: string;
    expertId: string;
    offeredAt: Date;
    deadlineAt: Date;
    respondedAt: Date | null;
    response: SeedResponse;
  }[] = [];
  const offeredAt = opts.offeredAt ?? new Date();
  const respondedAt = new Date(
    offeredAt.getTime() + (opts.responseDelaySec ?? 0) * 1000,
  );
  const push = (response: SeedResponse, count: number) => {
    for (let i = 0; i < count; i++) {
      rows.push({
        requestId: req.id,
        expertId,
        offeredAt,
        deadlineAt: new Date(offeredAt.getTime() + 30_000),
        respondedAt:
          response === 'ACCEPTED' || response === 'DECLINED'
            ? respondedAt
            : null,
        response,
      });
    }
  };
  push('ACCEPTED', outcomes.accepted ?? 0);
  push('DECLINED', outcomes.declined ?? 0);
  push('TIMEOUT', outcomes.timeout ?? 0);
  push('PENDING', outcomes.pending ?? 0);

  await prisma.requestCandidate.createMany({ data: rows });
}
