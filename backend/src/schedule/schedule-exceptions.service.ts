import { Injectable } from '@nestjs/common';
import { Expert, ScheduleException } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { apiError } from '../common/filters/app-exception.filter';
import { ALMATY_OFFSET_MINUTES } from '../booking/booking.constants';
import {
  ListScheduleExceptionsDto,
  ScheduleExceptionDto,
  UpsertScheduleExceptionDto,
} from './dto/schedule-exception.dto';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class ScheduleExceptionsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private clock: ClockService,
  ) {}

  async list(
    expertId: string,
    query: ListScheduleExceptionsDto,
  ): Promise<ScheduleExceptionDto[]> {
    const rows = await this.prisma.scheduleException.findMany({
      where: {
        expertId,
        date: {
          gte: query.from ? this.parseDate(query.from) : undefined,
          lte: query.to ? this.parseDate(query.to) : undefined,
        },
      },
      orderBy: [{ date: 'asc' }],
    });
    return rows.map((row) => this.toDto(row));
  }

  async upsert(
    expert: Expert,
    rawDate: string,
    dto: UpsertScheduleExceptionDto,
  ): Promise<ScheduleExceptionDto> {
    const date = this.parseDate(rawDate);
    // Прошедший день менять незачем: он уже прожит, и правка выглядела бы
    // как подчистка истории.
    if (this.dayKey(date) < this.dayKey(this.clock.now())) {
      apiError('SCHEDULE_EXCEPTION_PAST', 'Дата уже прошла', 400);
    }

    if (!dto.isDayOff) {
      const { startMin, endMin } = dto;
      if (
        startMin === undefined ||
        endMin === undefined ||
        startMin >= endMin
      ) {
        apiError(
          'SCHEDULE_EXCEPTION_INVALID',
          'Для иных часов нужны startMin и endMin, причём startMin < endMin',
          400,
        );
      }
    }

    const data = {
      isDayOff: dto.isDayOff,
      startMin: dto.isDayOff ? null : (dto.startMin ?? null),
      endMin: dto.isDayOff ? null : (dto.endMin ?? null),
    };
    const row = await this.prisma.scheduleException.upsert({
      where: { expertId_date: { expertId: expert.id, date } },
      create: { expertId: expert.id, date, ...data },
      update: data,
    });

    await this.audit.log({
      actorType: 'expert',
      actorId: expert.id,
      entity: 'expert',
      entityId: expert.id,
      transition: 'schedule_exception.set',
      payload: { date: rawDate, ...data },
    });

    return this.toDto(row);
  }

  async remove(expert: Expert, rawDate: string): Promise<void> {
    const date = this.parseDate(rawDate);
    // Идемпотентно: удаление того, чего нет, — не ошибка.
    const { count } = await this.prisma.scheduleException.deleteMany({
      where: { expertId: expert.id, date },
    });
    if (count === 0) return;

    await this.audit.log({
      actorType: 'expert',
      actorId: expert.id,
      entity: 'expert',
      entityId: expert.id,
      transition: 'schedule_exception.removed',
      payload: { date: rawDate },
    });
  }

  private toDto(row: ScheduleException): ScheduleExceptionDto {
    return {
      date: row.date.toISOString().slice(0, 10),
      isDayOff: row.isDayOff,
      startMin: row.startMin,
      endMin: row.endMin,
    };
  }

  /// Дата хранится как @db.Date, то есть как календарный день без времени;
  /// разбор идёт в UTC-полночь, иначе Postgres сдвинет день.
  private parseDate(raw: string): Date {
    if (!DATE_RE.test(raw)) {
      apiError('SCHEDULE_EXCEPTION_INVALID', 'Дата в формате YYYY-MM-DD', 400);
    }
    const date = new Date(`${raw}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      apiError('SCHEDULE_EXCEPTION_INVALID', 'Некорректная дата', 400);
    }
    return date;
  }

  /// Календарный день по Алматы: сравнивать «прошло или нет» надо в зоне
  /// специалиста, а не в UTC — иначе с полуночи до 05:00 сегодняшний день
  /// выглядит вчерашним.
  private dayKey(date: Date): string {
    return new Date(date.getTime() + ALMATY_OFFSET_MINUTES * 60_000)
      .toISOString()
      .slice(0, 10);
  }
}
