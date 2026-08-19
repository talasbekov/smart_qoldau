import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PresenceService } from '../presence/presence.service';
import { ScheduleService } from '../schedule/schedule.service';
import { ClockService } from '../common/clock/clock.service';
import { ScoringService } from './scoring.service';

export interface FindCandidatesParams {
  topicSlug: string;
  format: string;
  excludeExpertIds?: string[];
  urgentOnly?: boolean;
}

@Injectable()
export class MatchingService {
  constructor(
    private prisma: PrismaService,
    private presence: PresenceService,
    private schedule: ScheduleService,
    private clock: ClockService,
    private scoring: ScoringService,
  ) {}

  // Конвейер матчинга E3: presence (Redis, только свежие по heartbeat —
  // listFresh) — лишь подсказка о кандидатах; фактический допуск ВСЕГДА
  // перепроверяется из БД (verificationStatus, isBlocked, workStatus,
  // formats, topics), затем расписание на now(). Итог сортируется по скору
  // Р-12 (см. ScoringService), tie-break — меньше офферов за сегодня
  // (Asia/Almaty).
  async findCandidates(params: FindCandidatesParams): Promise<string[]> {
    const { topicSlug, format, excludeExpertIds = [], urgentOnly } = params;

    const availableIds = await this.presence.listFresh();
    const candidateIds = availableIds.filter(
      (id) => !excludeExpertIds.includes(id),
    );
    if (candidateIds.length === 0) return [];

    const experts = await this.prisma.expert.findMany({
      where: {
        id: { in: candidateIds },
        verificationStatus: 'VERIFIED',
        isBlocked: false,
        workStatus: 'ACCEPTING',
        formats: { has: format },
        topics: { some: { topic: { slug: topicSlug } } },
        ...(urgentOnly ? { acceptsUrgent: true } : {}),
      },
      select: { id: true },
    });

    const now = this.clock.now();
    const withinSchedule = await Promise.all(
      experts.map(async (e) => ({
        id: e.id,
        ok: await this.schedule.isWithinSchedule(e.id, now),
      })),
    );
    const eligibleIds = withinSchedule.filter((e) => e.ok).map((e) => e.id);
    if (eligibleIds.length === 0) return [];

    const todayStart = this.startOfAlmatyDay(now);
    const [scores, todayOffersCounts] = await Promise.all([
      Promise.all(
        eligibleIds.map(async (id) => ({
          id,
          score: await this.scoring.score(id),
        })),
      ),
      Promise.all(
        eligibleIds.map(async (id) => ({
          id,
          count: await this.prisma.requestCandidate.count({
            where: { expertId: id, offeredAt: { gte: todayStart } },
          }),
        })),
      ),
    ]);

    const scoreById = new Map(scores.map((s) => [s.id, s.score]));
    const todayCountById = new Map(
      todayOffersCounts.map((t) => [t.id, t.count]),
    );

    return [...eligibleIds].sort((a, b) => {
      const scoreDiff = (scoreById.get(b) ?? 0) - (scoreById.get(a) ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (todayCountById.get(a) ?? 0) - (todayCountById.get(b) ?? 0);
    });
  }

  private startOfAlmatyDay(date: Date): Date {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Almaty',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const ymd = formatter.format(date); // YYYY-MM-DD в Asia/Almaty
    // Asia/Almaty = UTC+5, без переходов на летнее время.
    return new Date(`${ymd}T00:00:00+05:00`);
  }
}
