import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ClockService } from '../common/clock/clock.service';
import { PrismaService } from '../prisma/prisma.service';
import { CRITICAL_TYPES, NotificationType } from './notification-templates';
import { PushProviderPort } from './provider/push-provider.port';

// Разбор очереди пушей (E11a, задача 3).
const SWEEP_BATCH = 50;
// Одновременных отправок за тик. Провайдер — внешняя система: сто
// параллельных запросов к нему это не «быстрее», а отказ по rate limit.
const CONCURRENCY = 10;
// Устройств на пользователя. Таблица растёт монотонно (каждая переустановка
// приложения добавляет токен), и без потолка веер по «пользователю с 200
// устройств» съедал бы весь тик.
const DEVICES_PER_USER = 20;
const MAX_ATTEMPTS = 5;
// Экспоненциальная задержка: 2с, 4с, 8с, 16с. Провайдер, лежащий минуту,
// не должен получать один и тот же запрос каждую секунду.
const BACKOFF_BASE_MS = 2000;

@Injectable()
export class OutboxSweepService {
  private readonly logger = new Logger(OutboxSweepService.name);

  constructor(
    private prisma: PrismaService,
    private clock: ClockService,
    private push: PushProviderPort,
  ) {}

  @Interval(1000)
  async intervalTick(): Promise<void> {
    try {
      await this.tick();
    } catch (e) {
      this.logger.error(
        `тик очереди пушей не удался: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  /// Возвращает число обработанных записей — как остальные sweep-сервисы.
  async tick(): Promise<number> {
    const now = this.clock.now();
    const batch = await this.prisma.notificationOutbox.findMany({
      where: { sentAt: null, deadAt: null, nextAttemptAt: { lte: now } },
      orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }],
      take: SWEEP_BATCH,
    });
    if (batch.length === 0) return 0;

    let processed = 0;
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const chunk = batch.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((row) => this.sendOne(row)),
      );
      processed += results.filter((r) => r.status === 'fulfilled').length;
    }
    return processed;
  }

  private async sendOne(row: {
    id: string;
    notificationId: string;
    userId: string;
    type: string;
    payload: unknown;
    attempts: number;
  }): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: row.notificationId },
      select: { title: true, body: true },
    });
    if (!notification) {
      // Уведомление удалено (ретенция или уборка теста) — отправлять нечего.
      await this.prisma.notificationOutbox.update({
        where: { id: row.id },
        data: { sentAt: this.clock.now(), lastError: 'notification missing' },
      });
      return;
    }

    const devices = await this.prisma.device.findMany({
      where: { userId: row.userId },
      orderBy: { createdAt: 'desc' },
      take: DEVICES_PER_USER,
    });

    const critical = CRITICAL_TYPES.has(row.type as NotificationType);
    const data = row.payload as Record<string, string>;

    let sentAtLeastOnce = false;
    let lastError: string | undefined;
    for (const device of devices) {
      try {
        await this.push.send({
          token: device.token,
          title: notification.title,
          body: notification.body,
          data,
          critical,
        });
        sentAtLeastOnce = true;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }

    const now = this.clock.now();
    // Нет устройств — отправлять некуда, и это не ошибка: клиент может не
    // регистрировать токен (пуши выключены). Запись закрывается, чтобы не
    // висеть в очереди вечно.
    if (devices.length === 0 || sentAtLeastOnce) {
      await this.prisma.notificationOutbox.update({
        where: { id: row.id },
        data: { sentAt: now, attempts: row.attempts + 1, lastError },
      });
      if (sentAtLeastOnce) {
        await this.prisma.notification.update({
          where: { id: row.notificationId },
          data: { pushSentAt: now },
        });
      }
      return;
    }

    const attempts = row.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      // Мёртвая запись: помечается и больше не берётся, но НЕ удаляется —
      // по ней потом видно, что именно не доставлено и почему.
      await this.prisma.notificationOutbox.update({
        where: { id: row.id },
        data: { attempts, deadAt: now, lastError },
      });
      this.logger.warn(
        `пуш ${row.type} пользователю ${row.userId} не доставлен за ${attempts} попыток: ${lastError}`,
      );
      return;
    }

    await this.prisma.notificationOutbox.update({
      where: { id: row.id },
      data: {
        attempts,
        lastError,
        nextAttemptAt: new Date(
          now.getTime() + BACKOFF_BASE_MS * 2 ** (attempts - 1),
        ),
      },
    });
  }
}
