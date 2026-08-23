import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { PrismaService } from '../prisma/prisma.service';

// Ретенция (E11a, задача 10). Таблицы `provider_events` и `notifications`
// растут монотонно: каждый вебхук провайдера и каждое уведомление остаются
// навсегда. Через год работы это гигабайты, которые никто не читает.
const BATCH = 1000;
// Пауза между пачками: единовременный deleteMany на выросшей таблице
// держит блокировку долго и мешает боевым запросам.
const BATCH_PAUSE_MS = 50;
const HOUR_MS = 3_600_000;

export interface RetentionSummary {
  providerEvents: number;
  notifications: number;
}

@Injectable()
export class RetentionSweepService {
  private readonly logger = new Logger(RetentionSweepService.name);
  private lastSummaryAt: Date | null = null;

  constructor(
    private prisma: PrismaService,
    private clock: ClockService,
    private audit: AuditService,
    private config: ConfigService,
  ) {}

  @Interval(HOUR_MS)
  async intervalTick(): Promise<void> {
    try {
      await this.sweep();
    } catch (e) {
      this.logger.error(
        `уборка по ретенции не удалась: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async sweep(): Promise<RetentionSummary> {
    const now = this.clock.now();
    const providerCutoff = this.cutoff(
      now,
      Number(this.config.get('RETENTION_PROVIDER_EVENT_DAYS', '30')),
    );
    const notificationCutoff = this.cutoff(
      now,
      Number(this.config.get('RETENTION_NOTIFICATION_DAYS', '90')),
    );

    const providerEvents = await this.deleteInBatches(async () => {
      const rows = await this.prisma.providerEvent.findMany({
        where: { createdAt: { lt: providerCutoff } },
        select: { id: true },
        take: BATCH,
      });
      if (rows.length === 0) return { count: 0 };
      return this.prisma.providerEvent.deleteMany({
        where: { id: { in: rows.map((r) => r.id) } },
      });
    });

    const notifications = await this.deleteInBatches(async () => {
      const rows = await this.prisma.notification.findMany({
        // Непрочитанные не удаляются НИКОГДА, независимо от возраста:
        // человек, не заходивший полгода, не должен потерять запись о
        // начислении или отменённой консультации.
        where: { readAt: { not: null }, createdAt: { lt: notificationCutoff } },
        select: { id: true },
        take: BATCH,
      });
      if (rows.length === 0) return { count: 0 };
      return this.prisma.notification.deleteMany({
        where: { id: { in: rows.map((r) => r.id) } },
      });
    });

    await this.logSummaryOncePerDay(now, { providerEvents, notifications });
    return { providerEvents, notifications };
  }

  private cutoff(now: Date, days: number): Date {
    return new Date(now.getTime() - days * 24 * HOUR_MS);
  }

  /// Удаляет пачками, пока пачки не станут пустыми: одна большая операция
  /// на выросшей таблице блокирует её надолго.
  private async deleteInBatches(
    deleteBatch: () => Promise<{ count: number }>,
  ): Promise<number> {
    let total = 0;
    for (;;) {
      const { count } = await deleteBatch();
      total += count;
      if (count < BATCH) return total;
      await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS));
    }
  }

  /// Сводка в audit — раз в сутки. Без неё уборка невидима, и её сбой
  /// (или наоборот, слишком жадное удаление) никто не заметит.
  private async logSummaryOncePerDay(
    now: Date,
    summary: RetentionSummary,
  ): Promise<void> {
    if (
      this.lastSummaryAt &&
      now.getTime() - this.lastSummaryAt.getTime() < 24 * HOUR_MS
    ) {
      return;
    }
    this.lastSummaryAt = now;
    await this.audit.log({
      actorType: 'system',
      entity: 'maintenance',
      entityId: 'retention',
      transition: 'maintenance.retention_swept',
      payload: { ...summary },
    });
  }
}
