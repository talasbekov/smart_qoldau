import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ConsultationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../common/clock/clock.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventsService } from '../ws/events.service';
import { AuditService } from '../audit/audit.service';
import { ConsultationsService } from './consultations.service';
import { REMINDER_MINUTES } from '../booking/booking.constants';

// Sweep плановых консультаций (E6b, задача 6). Тик раз в полминуты, а не
// раз в секунду, как у офферов: для напоминания за 15 минут точности до
// полуминуты достаточно, а нагрузка на БД в 30 раз ниже.
const TICK_MS = 30_000;
const MS_PER_MINUTE = 60_000;

@Injectable()
export class ScheduledSweepService {
  private readonly logger = new Logger(ScheduledSweepService.name);

  constructor(
    private prisma: PrismaService,
    private clock: ClockService,
    private notifications: NotificationsService,
    private events: EventsService,
    private consultations: ConsultationsService,
    private audit: AuditService,
  ) {}

  @Interval(TICK_MS)
  async tick(): Promise<void> {
    try {
      await this.remind();
      await this.activate();
    } catch (e) {
      this.logger.error(
        `тик плановых консультаций упал: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  /// Напоминание за 15 минут обеим сторонам (Р-15). Окно начинается с
  /// «сейчас»: напоминать о том, что уже началось, бессмысленно — такую
  /// запись подхватит активация.
  private async remind(): Promise<void> {
    const now = this.clock.now();
    const rows = await this.prisma.consultation.findMany({
      where: {
        status: ConsultationStatus.SCHEDULED,
        remindedAt: null,
        startedAt: {
          gte: now,
          lte: new Date(now.getTime() + REMINDER_MINUTES * MS_PER_MINUTE),
        },
      },
    });

    for (const row of rows) {
      // Право на отправку даёт только успешный условный апдейт: иначе две
      // реплики пришлют два напоминания об одной консультации.
      const claimed = await this.prisma.consultation.updateMany({
        where: { id: row.id, remindedAt: null },
        data: { remindedAt: now },
      });
      if (claimed.count === 0) continue;

      // Без темы, имени и цены — PII-правило пушей E9.
      await this.notifications.dispatch(
        row.clientUserId,
        'consultation.reminder',
        { consultationId: row.id },
      );
      await this.notifications.dispatchToExpert(
        row.expertId,
        'consultation.reminder',
        { consultationId: row.id },
      );

      await this.audit.log({
        actorType: 'system',
        entity: 'consultation',
        entityId: row.id,
        transition: 'consultation.reminder_sent',
      });
    }
  }

  /// Наступивший слот переводит запись в ACTIVE. Если инстанс лежал,
  /// просроченные записи активируются разом — по одной, чтобы падение на
  /// одной не съело остальные.
  private async activate(): Promise<void> {
    const now = this.clock.now();
    const rows = await this.prisma.consultation.findMany({
      where: {
        status: ConsultationStatus.SCHEDULED,
        startedAt: { lte: now },
      },
    });

    for (const row of rows) {
      const claimed = await this.prisma.consultation.updateMany({
        where: { id: row.id, status: ConsultationStatus.SCHEDULED },
        data: { status: ConsultationStatus.ACTIVE },
      });
      if (claimed.count === 0) continue;

      // Авто-BUSY (Р-13): в момент слота специалист занят так же, как при
      // мгновенном матче.
      await this.consultations.markExpertBusy(row.expertId);

      const payload = {
        id: row.id,
        status: ConsultationStatus.ACTIVE,
        startedAt: row.startedAt.toISOString(),
      };
      this.events.emitToUser(row.clientUserId, 'consultation.updated', payload);
      this.events.emitToExpert(row.expertId, 'consultation.updated', payload);

      await this.audit.log({
        actorType: 'system',
        entity: 'consultation',
        entityId: row.id,
        transition: 'consultation.activated',
      });
    }
  }
}
