import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const HISTORY_WINDOW = 50;
const AVG_RESPONSE_TARGET_SEC = 45;

@Injectable()
export class ScoringService {
  constructor(private prisma: PrismaService) {}

  /// Пакетная версия [score] для матчинга: один запрос на весь список
  /// вместо запроса на каждого эксперта (при 500 онлайн это было 500
  /// обращений к БД на одну заявку — см. нагрузочный прогон E11).
  ///
  /// «Последние 50 офферов НА КАЖДОГО эксперта» Prisma-выборкой не
  /// выражается, поэтому окно нарезается `ROW_NUMBER()` в SQL. Наружу
  /// возвращаются только агрегаты, а формула Р-12 остаётся в TypeScript
  /// (в [combine]) — единственной и общей для обеих версий.
  async scoreMany(expertIds: string[]): Promise<Map<string, number>> {
    if (expertIds.length === 0) return new Map();

    const rows = await this.prisma.$queryRaw<
      {
        expert_id: string;
        accepted: bigint;
        denom: bigint;
        responded: bigint;
        total_response_sec: number | null;
      }[]
    >`
      WITH windowed AS (
        SELECT
          expert_id,
          response,
          offered_at,
          responded_at,
          ROW_NUMBER() OVER (
            PARTITION BY expert_id ORDER BY offered_at DESC
          ) AS rn
        FROM request_candidates
        WHERE expert_id = ANY(${expertIds}::text[])
          AND response IN ('ACCEPTED', 'DECLINED', 'TIMEOUT')
      )
      SELECT
        expert_id,
        COUNT(*) FILTER (WHERE response = 'ACCEPTED') AS accepted,
        COUNT(*) AS denom,
        COUNT(*) FILTER (
          WHERE response IN ('ACCEPTED', 'DECLINED') AND responded_at IS NOT NULL
        ) AS responded,
        COALESCE(SUM(
          EXTRACT(EPOCH FROM (responded_at - offered_at))
        ) FILTER (
          WHERE response IN ('ACCEPTED', 'DECLINED') AND responded_at IS NOT NULL
        ), 0)::float8 AS total_response_sec
      FROM windowed
      WHERE rn <= ${HISTORY_WINDOW}
      GROUP BY expert_id
    `;

    const scores = new Map<string, number>();
    for (const row of rows) {
      scores.set(
        row.expert_id,
        this.combine({
          accepted: Number(row.accepted),
          denom: Number(row.denom),
          responded: Number(row.responded),
          totalResponseSec: row.total_response_sec ?? 0,
        }),
      );
    }
    // Эксперт без истории офферов в выборку не попадает вовсе — у него
    // те же 0.5, что и в однократной версии.
    for (const id of expertIds) if (!scores.has(id)) scores.set(id, 0.5);
    return scores;
  }

  /// Формула Р-12 поверх агрегатов последних 50 офферов. Пустая история —
  /// 0.5 (нейтральный новичок), а не 0: иначе новый специалист навсегда
  /// оставался бы в конце очереди и истории не набрал.
  private combine(agg: {
    accepted: number;
    denom: number;
    responded: number;
    totalResponseSec: number;
  }): number {
    if (agg.denom === 0) return 0.5;
    const acceptRate = agg.accepted / agg.denom;
    const speed =
      agg.responded === 0
        ? 0
        : Math.max(
            0,
            1 - agg.totalResponseSec / agg.responded / AVG_RESPONSE_TARGET_SEC,
          );
    return acceptRate * 0.6 + speed * 0.4;
  }

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
