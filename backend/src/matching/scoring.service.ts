import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const HISTORY_WINDOW = 50;
const AVG_RESPONSE_TARGET_SEC = 45;

@Injectable()
export class ScoringService {
  constructor(private prisma: PrismaService) {}

  // Р-12: score = acceptRate*0.6 + speed*0.4 по последним 50 офферам эксперта.
  // acceptRate = ACCEPTED / (ACCEPTED + DECLINED + TIMEOUT).
  // speed = max(0, 1 − avgОтветСек/45), считается только по офферам с
  // respondedAt (ACCEPTED/DECLINED) — TIMEOUT не участвует в скорости, но
  // участвует в знаменателе acceptRate. Без истории -> 0.5.
  async score(expertId: string): Promise<number> {
    const candidates = await this.prisma.requestCandidate.findMany({
      where: {
        expertId,
        response: { in: ['ACCEPTED', 'DECLINED', 'TIMEOUT'] },
      },
      orderBy: { offeredAt: 'desc' },
      take: HISTORY_WINDOW,
      select: { response: true, offeredAt: true, respondedAt: true },
    });

    if (candidates.length === 0) return 0.5;

    const accepted = candidates.filter((c) => c.response === 'ACCEPTED');
    const declined = candidates.filter((c) => c.response === 'DECLINED');
    const timeout = candidates.filter((c) => c.response === 'TIMEOUT');
    const denom = accepted.length + declined.length + timeout.length;
    const acceptRate = denom === 0 ? 0 : accepted.length / denom;

    const responded = candidates.filter(
      (c) =>
        (c.response === 'ACCEPTED' || c.response === 'DECLINED') &&
        c.respondedAt !== null,
    );
    let speed: number;
    if (responded.length === 0) {
      speed = 0;
    } else {
      const totalSec = responded.reduce(
        (sum, c) =>
          sum + (c.respondedAt!.getTime() - c.offeredAt.getTime()) / 1000,
        0,
      );
      const avgSec = totalSec / responded.length;
      speed = Math.max(0, 1 - avgSec / AVG_RESPONSE_TARGET_SEC);
    }

    return acceptRate * 0.6 + speed * 0.4;
  }
}
