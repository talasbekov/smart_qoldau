import { Injectable } from '@nestjs/common';
import { Expert, ExpertScheduleDay, ScheduleException } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/filters/app-exception.filter';
import { ScheduleDayDto, UpdateScheduleDto } from './dto/schedule-day.dto';
import { UpdateAvailabilityDto } from './dto/availability.dto';
import { ALMATY_OFFSET_MINUTES } from '../booking/booking.constants';

const DEFAULT_START_MIN = 540; // 09:00
const DEFAULT_END_MIN = 1080; // 18:00
const MINUTES_PER_DAY = 1440;

@Injectable()
export class ScheduleService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async getSchedule(expertId: string): Promise<ScheduleDayDto[]> {
    const rows = await this.prisma.expertScheduleDay.findMany({
      where: { expertId },
      orderBy: { weekday: 'asc' },
    });
    const byWeekday = new Map(rows.map((r) => [r.weekday, r]));
    const days: ScheduleDayDto[] = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      const row = byWeekday.get(weekday);
      if (row) {
        days.push({
          weekday: row.weekday,
          enabled: row.enabled,
          startMin: row.startMin,
          endMin: row.endMin,
          breakStart: row.breakStart,
          breakEnd: row.breakEnd,
        });
      } else {
        days.push({
          weekday,
          enabled: false,
          startMin: DEFAULT_START_MIN,
          endMin: DEFAULT_END_MIN,
          breakStart: null,
          breakEnd: null,
        });
      }
    }
    return days;
  }

  async updateSchedule(
    expert: Expert,
    dto: UpdateScheduleDto,
  ): Promise<ScheduleDayDto[]> {
    this.validate(dto.days);

    await this.prisma.$transaction([
      this.prisma.expertScheduleDay.deleteMany({
        where: { expertId: expert.id },
      }),
      this.prisma.expertScheduleDay.createMany({
        data: dto.days.map((d) => ({
          expertId: expert.id,
          weekday: d.weekday,
          enabled: d.enabled,
          startMin: d.startMin,
          endMin: d.endMin,
          breakStart: d.breakStart ?? null,
          breakEnd: d.breakEnd ?? null,
        })),
      }),
    ]);

    await this.audit.log({
      actorType: 'expert',
      actorId: expert.id,
      entity: 'expert',
      entityId: expert.id,
      transition: 'expert.schedule_updated',
      payload: dto as unknown as object,
    });

    return this.getSchedule(expert.id);
  }

  async updateAvailability(
    expert: Expert,
    dto: UpdateAvailabilityDto,
  ): Promise<Expert> {
    const updated = await this.prisma.expert.update({
      where: { id: expert.id },
      data: { acceptsUrgent: dto.acceptsUrgent },
    });

    await this.audit.log({
      actorType: 'expert',
      actorId: expert.id,
      entity: 'expert',
      entityId: expert.id,
      transition: 'expert.availability_updated',
      payload: { acceptsUrgent: dto.acceptsUrgent },
    });

    return updated;
  }

  /// Пакетная версия [isWithinSchedule] для матчинга: два запроса на весь
  /// список вместо двух на каждого эксперта. При 500 онлайн это была
  /// тысяча обращений к БД на одну заявку — нагрузочный прогон E11
  /// показал 30 секунд на `POST /requests` именно из-за таких N+1.
  /// Правило доступности одно и то же, поэтому оно вынесено в чистую
  /// [matchesSchedule], которой пользуются обе версии.
  async filterWithinSchedule(
    expertIds: string[],
    date: Date,
  ): Promise<Set<string>> {
    if (expertIds.length === 0) return new Set();
    const { weekday, minutes } = this.toAlmatyWeekdayMinutes(date);

    const [exceptions, days] = await Promise.all([
      this.prisma.scheduleException.findMany({
        where: { expertId: { in: expertIds }, date: this.almatyDayStart(date) },
      }),
      this.prisma.expertScheduleDay.findMany({
        where: { expertId: { in: expertIds }, weekday },
      }),
    ]);

    const exceptionBy = new Map(exceptions.map((e) => [e.expertId, e]));
    const dayBy = new Map(days.map((d) => [d.expertId, d]));

    const allowed = new Set<string>();
    for (const id of expertIds) {
      if (
        this.matchesSchedule(
          exceptionBy.get(id) ?? null,
          dayBy.get(id) ?? null,
          minutes,
        )
      )
        allowed.add(id);
    }
    return allowed;
  }

  /// Единственное место, где живёт правило «доступен ли специалист в эту
  /// минуту»: исключение на дату перекрывает недельное расписание целиком
  /// (E6b) — выходной закрывает день, иные часы заменяют собой окно, а не
  /// сужают его.
  private matchesSchedule(
    exception: ScheduleException | null,
    day: ExpertScheduleDay | null,
    minutes: number,
  ): boolean {
    if (exception) {
      if (exception.isDayOff) return false;
      if (exception.startMin === null || exception.endMin === null)
        return false;
      return minutes >= exception.startMin && minutes < exception.endMin;
    }

    if (!day || !day.enabled) return false;
    if (minutes < day.startMin || minutes >= day.endMin) return false;
    if (day.breakStart !== null && day.breakEnd !== null) {
      if (minutes >= day.breakStart && minutes < day.breakEnd) return false;
    }
    return true;
  }

  // Контракт для матчинга E3: проверяет доступность эксперта в момент date
  // по TZ Asia/Almaty (enabled -> интервал -> вне перерыва).
  async isWithinSchedule(expertId: string, date: Date): Promise<boolean> {
    const { weekday, minutes } = this.toAlmatyWeekdayMinutes(date);

    const [exception, day] = await Promise.all([
      this.prisma.scheduleException.findUnique({
        where: {
          expertId_date: { expertId, date: this.almatyDayStart(date) },
        },
      }),
      this.prisma.expertScheduleDay.findUnique({
        where: { expertId_weekday: { expertId, weekday } },
      }),
    ]);

    return this.matchesSchedule(exception, day, minutes);
  }

  /// UTC-полночь календарного дня по Алматы — в этом виде хранится
  /// `ScheduleException.date` (@db.Date).
  private almatyDayStart(date: Date): Date {
    const key = new Date(date.getTime() + ALMATY_OFFSET_MINUTES * 60_000)
      .toISOString()
      .slice(0, 10);
    return new Date(`${key}T00:00:00.000Z`);
  }

  private toAlmatyWeekdayMinutes(date: Date): {
    weekday: number;
    minutes: number;
  } {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Almaty',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const weekdayShort = parts.find((p) => p.type === 'weekday')!.value;
    let hour = Number(parts.find((p) => p.type === 'hour')!.value);
    const minute = Number(parts.find((p) => p.type === 'minute')!.value);
    if (hour === 24) hour = 0;

    const JS_WEEKDAY_BY_SHORT: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const jsDay = JS_WEEKDAY_BY_SHORT[weekdayShort];
    const weekday = (jsDay + 6) % 7; // JS-воскресенье=0 -> наш Пн=0

    return { weekday, minutes: hour * 60 + minute };
  }

  private validate(days: ScheduleDayDto[]): void {
    if (days.length !== 7)
      apiError(
        'SCHEDULE_INVALID',
        'Расписание должно содержать ровно 7 дней',
        400,
      );

    const weekdays = new Set(days.map((d) => d.weekday));
    if (weekdays.size !== 7 || [...weekdays].some((w) => w < 0 || w > 6))
      apiError(
        'SCHEDULE_INVALID',
        'Дни недели должны быть уникальными значениями 0-6',
        400,
      );

    for (const d of days) {
      if (!d.enabled) continue;

      if (!(
        d.startMin >= 0 &&
        d.startMin < d.endMin &&
        d.endMin <= MINUTES_PER_DAY
      ))
        apiError(
          'SCHEDULE_INVALID',
          `День ${d.weekday}: должно выполняться 0 <= startMin < endMin <= 1440`,
          400,
        );

      const hasBreakStart = d.breakStart !== null && d.breakStart !== undefined;
      const hasBreakEnd = d.breakEnd !== null && d.breakEnd !== undefined;

      if (hasBreakStart !== hasBreakEnd)
        apiError(
          'SCHEDULE_INVALID',
          `День ${d.weekday}: breakStart и breakEnd должны быть заданы оба или ни один`,
          400,
        );

      if (hasBreakStart && hasBreakEnd) {
        const breakStart = d.breakStart as number;
        const breakEnd = d.breakEnd as number;
        if (!(
          d.startMin <= breakStart &&
          breakStart < breakEnd &&
          breakEnd <= d.endMin
        ))
          apiError(
            'SCHEDULE_INVALID',
            `День ${d.weekday}: перерыв должен быть в пределах startMin <= breakStart < breakEnd <= endMin`,
            400,
          );
      }
    }
  }
}
