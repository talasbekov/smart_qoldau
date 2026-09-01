import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../common/clock/clock.service';

/// Единственный часовой пояс продукта в MVP. Считать дни в UTC значит
/// отбирать у людей день практики каждый вечер: 19:30 UTC — это уже
/// следующий день в Алматы.
const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function toAlmatyDate(at: Date): string {
  return new Date(at.getTime() + ALMATY_OFFSET_MS).toISOString().slice(0, 10);
}

function dayNumber(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / DAY_MS);
}

function uniqueDaysDesc(days: Date[]): number[] {
  const set = new Set(days.map((d) => dayNumber(toAlmatyDate(d))));
  return [...set].sort((a, b) => b - a);
}

/// Текущий стрик: сколько дней подряд человек занимался, считая от сегодня
/// или от вчера. Стрик рвётся пропущенным ДНЁМ, а не наступлением полуночи
/// — иначе он «теряется» у каждого, кто ещё не успел зайти с утра.
export function currentStreak(days: Date[], now: Date): number {
  const sorted = uniqueDaysDesc(days);
  if (sorted.length === 0) return 0;

  const today = dayNumber(toAlmatyDate(now));
  if (sorted[0] !== today && sorted[0] !== today - 1) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] - 1) break;
    streak++;
  }
  return streak;
}

/// Самый длинный стрик за всю историю — по всем дням, а не по хвосту.
export function longestStreak(days: Date[]): number {
  const sorted = uniqueDaysDesc(days);
  if (sorted.length === 0) return 0;

  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === sorted[i - 1] - 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

export interface StreakDto {
  currentDays: number;
  longestDays: number;
  completedCount: number;
}

@Injectable()
export class StreakService {
  constructor(
    private prisma: PrismaService,
    private clock: ClockService,
  ) {}

  /// Стрик считается по датам активности, а не хранится числом: хранимое
  /// значение протухает молча — оно остаётся прежним ровно тогда, когда
  /// человек перестал заходить.
  async of(userId: string): Promise<StreakDto> {
    const [rows, completedCount] = await Promise.all([
      this.prisma.contentProgress.findMany({
        where: { userId },
        select: { updatedAt: true },
      }),
      this.prisma.contentProgress.count({
        where: { userId, completedAt: { not: null } },
      }),
    ]);
    const days = rows.map((r) => r.updatedAt);

    return {
      currentDays: currentStreak(days, this.clock.now()),
      longestDays: longestStreak(days),
      completedCount,
    };
  }
}
