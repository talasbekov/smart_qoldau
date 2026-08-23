import { Injectable } from '@nestjs/common';
import { ConsultationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../common/clock/clock.service';
import {
  ALMATY_OFFSET_MINUTES,
  LEAD_MINUTES,
  SESSION_MINUTES,
  SLOT_MINUTES,
} from './booking.constants';

// Свободные слоты считаются на лету: расписание минус исключения минус
// занятые интервалы. Отдельная таблица слотов была бы денормализацией
// расписания, которую пришлось бы держать в согласии при каждой правке.
const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

/// Момент UTC по локальному времени Алматы. Единственное место перевода в
/// проекте: Казахстан не переводит часы, поэтому смещение постоянное.
export function almatyLocalToUtc(
  dayStartUtc: Date,
  minutesFromMidnight: number,
): Date {
  return new Date(
    dayStartUtc.getTime() +
      (minutesFromMidnight - ALMATY_OFFSET_MINUTES) * MS_PER_MINUTE,
  );
}

/// Календарный день по Алматы как UTC-полночь — в этом виде хранится
/// `ScheduleException.date` (@db.Date).
export function almatyDayStart(date: Date): Date {
  const key = new Date(date.getTime() + ALMATY_OFFSET_MINUTES * MS_PER_MINUTE)
    .toISOString()
    .slice(0, 10);
  return new Date(`${key}T00:00:00.000Z`);
}

@Injectable()
export class SlotsService {
  constructor(
    private prisma: PrismaService,
    private clock: ClockService,
  ) {}

  async freeSlots(expertId: string, from: Date, to: Date): Promise<Date[]> {
    const [days, exceptions, busy] = await Promise.all([
      this.prisma.expertScheduleDay.findMany({ where: { expertId } }),
      this.prisma.scheduleException.findMany({
        where: {
          expertId,
          date: { gte: almatyDayStart(from), lte: almatyDayStart(to) },
        },
      }),
      this.prisma.consultation.findMany({
        where: {
          expertId,
          status: {
            in: [ConsultationStatus.SCHEDULED, ConsultationStatus.ACTIVE],
          },
          startedAt: {
            gte: new Date(from.getTime() - SESSION_MINUTES * MS_PER_MINUTE),
            lte: to,
          },
        },
        select: { startedAt: true },
      }),
    ]);

    const byWeekday = new Map(days.map((d) => [d.weekday, d]));
    const byDay = new Map(
      exceptions.map((e) => [e.date.toISOString().slice(0, 10), e]),
    );
    const busyStarts = busy.map((c) => c.startedAt.getTime());
    const earliest = this.clock.now().getTime() + LEAD_MINUTES * MS_PER_MINUTE;

    const slots: Date[] = [];
    for (
      let dayStart = almatyDayStart(from);
      dayStart.getTime() <= almatyDayStart(to).getTime();
      dayStart = new Date(dayStart.getTime() + MS_PER_DAY)
    ) {
      const window = this.windowOf(dayStart, byWeekday, byDay);
      if (!window) continue;

      for (
        let minute = window.startMin;
        minute + SESSION_MINUTES <= window.endMin;
        minute += SLOT_MINUTES
      ) {
        // Слот, накрывающий перерыв, не предлагается: специалист в это
        // время не работает, и «половина сессии» смысла не имеет.
        if (
          window.breakStart !== null &&
          window.breakEnd !== null &&
          minute < window.breakEnd &&
          minute + SESSION_MINUTES > window.breakStart
        ) {
          continue;
        }

        const start = almatyLocalToUtc(dayStart, minute);
        const time = start.getTime();
        if (time < earliest) continue;
        if (time < from.getTime() || time > to.getTime()) continue;
        // Занято, если интервалы пересекаются: сессия длится 50 минут, а
        // сетка шагает на 60, так что достаточно сравнить начала.
        if (
          busyStarts.some(
            (busyStart) =>
              time < busyStart + SESSION_MINUTES * MS_PER_MINUTE &&
              busyStart < time + SESSION_MINUTES * MS_PER_MINUTE,
          )
        ) {
          continue;
        }
        slots.push(start);
      }
    }

    return slots.sort((a, b) => a.getTime() - b.getTime());
  }

  /// Рабочее окно дня: исключение перекрывает недельное расписание
  /// целиком, а не сужает его.
  private windowOf(
    dayStart: Date,
    byWeekday: Map<
      number,
      {
        enabled: boolean;
        startMin: number;
        endMin: number;
        breakStart?: number | null;
        breakEnd?: number | null;
      }
    >,
    byDay: Map<
      string,
      { isDayOff: boolean; startMin?: number | null; endMin?: number | null }
    >,
  ): {
    startMin: number;
    endMin: number;
    breakStart: number | null;
    breakEnd: number | null;
  } | null {
    const exception = byDay.get(dayStart.toISOString().slice(0, 10));
    if (exception) {
      if (
        exception.isDayOff ||
        exception.startMin === null ||
        exception.startMin === undefined ||
        exception.endMin === null ||
        exception.endMin === undefined
      ) {
        return null;
      }
      return {
        startMin: exception.startMin,
        endMin: exception.endMin,
        breakStart: null,
        breakEnd: null,
      };
    }

    // Понедельник = 0, как в ExpertScheduleDay.
    const weekday = (dayStart.getUTCDay() + 6) % 7;
    const row = byWeekday.get(weekday);
    if (!row?.enabled) return null;
    return {
      startMin: row.startMin,
      endMin: row.endMin,
      breakStart: row.breakStart ?? null,
      breakEnd: row.breakEnd ?? null,
    };
  }
}
