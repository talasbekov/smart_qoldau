import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { NotificationOutbox, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
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
// Каждый transport call ограничен по времени. Вместе с renew перед каждым
// устройством это гарантирует, что активный fanout не переживёт lease молча,
// а зависший provider не удержит worker promise навсегда.
const PUSH_TIMEOUT_MS = 10_000;
// Crash после claim не оставляет строку занятой навсегда. Если процесс
// исчезнет, другой worker повторно заберёт job после истечения lease.
// Crash после внешнего send, но до DB ack, неизбежно даёт повторную отправку:
// граница доставки at-least-once, а notificationId в payload — ключ дедупа.
const LEASE_MS = 60_000;

type ClaimedOutboxRow = Pick<
  NotificationOutbox,
  'id' | 'notificationId' | 'userId' | 'type' | 'payload' | 'attempts'
>;

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
    const leaseToken = randomUUID();
    const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);
    const batch = await this.claimBatch(now, leaseToken, leaseExpiresAt);
    if (batch.length === 0) return 0;

    let processed = 0;
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const chunk = batch.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((row) => this.sendOne(row, leaseToken)),
      );
      processed += results.filter(
        (result) => result.status === 'fulfilled' && result.value,
      ).length;
    }
    return processed;
  }

  private async claimBatch(
    now: Date,
    leaseToken: string,
    leaseExpiresAt: Date,
  ): Promise<ClaimedOutboxRow[]> {
    // Selection and lease assignment are one PostgreSQL statement. Row locks
    // exist only for this short statement; provider I/O never holds a DB
    // transaction. SKIP LOCKED lets other workers claim different jobs.
    return this.prisma.$queryRaw<ClaimedOutboxRow[]>(Prisma.sql`
      WITH candidates AS (
        SELECT id
        FROM notification_outbox
        WHERE sent_at IS NULL
          AND dead_at IS NULL
          AND next_attempt_at <= ${now}
          AND (lease_expires_at IS NULL OR lease_expires_at <= ${now})
        ORDER BY next_attempt_at ASC, id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${SWEEP_BATCH}
      )
      UPDATE notification_outbox AS target
      SET lease_token = ${leaseToken}, lease_expires_at = ${leaseExpiresAt}
      FROM candidates
      WHERE target.id = candidates.id
      RETURNING
        target.id,
        target.notification_id AS "notificationId",
        target.user_id AS "userId",
        target.type,
        target.payload,
        target.attempts
    `);
  }

  private async sendOne(
    row: ClaimedOutboxRow,
    leaseToken: string,
  ): Promise<boolean> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: row.notificationId },
      select: { title: true, body: true },
    });
    if (!notification) {
      // Уведомление удалено (ретенция или уборка теста) — отправлять нечего.
      const settled = await this.prisma.notificationOutbox.updateMany({
        where: { id: row.id, leaseToken, sentAt: null, deadAt: null },
        data: {
          sentAt: this.clock.now(),
          attempts: row.attempts + 1,
          lastError: 'notification missing',
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });
      return settled.count === 1;
    }

    const devices = await this.prisma.device.findMany({
      where: { userId: row.userId },
      orderBy: { createdAt: 'desc' },
      take: DEVICES_PER_USER,
    });

    const critical = CRITICAL_TYPES.has(row.type as NotificationType);
    const data = row.payload as Record<string, string>;

    let transportFailed = false;
    let lastError: string | undefined;
    for (const device of devices) {
      // Batch claim мог истечь, пока предыдущий chunk обрабатывался. Перед
      // КАЖДЫМ внешним side effect продлеваем только ещё действующий lease.
      // Если другой worker уже reclaim/ack строки, старый token не проходит
      // compare-and-set и provider больше не вызывается.
      if (!(await this.renewLease(row.id, leaseToken))) return false;
      try {
        await this.sendWithTimeout({
          token: device.token,
          title: notification.title,
          body: notification.body,
          data,
          critical,
        });
      } catch (e) {
        transportFailed = true;
        const message = e instanceof Error ? e.message : String(e);
        lastError = message || 'push transport failed without an error message';
      }
    }

    const now = this.clock.now();
    // Нет устройств — отправлять некуда, и это не ошибка: клиент может не
    // регистрировать токен (пуши выключены). Запись закрывается, чтобы не
    // висеть в очереди вечно.
    if (devices.length === 0) {
      const settled = await this.prisma.notificationOutbox.updateMany({
        where: { id: row.id, leaseToken, sentAt: null, deadAt: null },
        data: {
          sentAt: now,
          attempts: row.attempts + 1,
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });
      return settled.count === 1;
    }

    // Job представляет веер на ВСЕ актуальные устройства. Подтверждать его,
    // когда один transport call упал, нельзя: следующая попытка повторит весь
    // веер. Уже успешное устройство может получить дубль; это осознанная
    // at-least-once граница, клиент дедуплицирует по notificationId.
    if (!transportFailed) {
      return this.prisma.$transaction(async (tx) => {
        const settled = await tx.notificationOutbox.updateMany({
          where: { id: row.id, leaseToken, sentAt: null, deadAt: null },
          data: {
            sentAt: now,
            attempts: row.attempts + 1,
            leaseToken: null,
            leaseExpiresAt: null,
          },
        });
        if (settled.count === 0) return false;
        await tx.notification.updateMany({
          where: { id: row.notificationId },
          data: { pushSentAt: now },
        });
        return true;
      });
    }

    const attempts = row.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      // Мёртвая запись: помечается и больше не берётся, но НЕ удаляется —
      // по ней потом видно, что именно не доставлено и почему.
      const settled = await this.prisma.notificationOutbox.updateMany({
        where: { id: row.id, leaseToken, sentAt: null, deadAt: null },
        data: {
          attempts,
          deadAt: now,
          lastError,
          leaseToken: null,
          leaseExpiresAt: null,
        },
      });
      if (settled.count === 1) {
        this.logger.warn(
          `пуш ${row.type} пользователю ${row.userId} не доставлен за ${attempts} попыток: ${lastError}`,
        );
      }
      return settled.count === 1;
    }

    const settled = await this.prisma.notificationOutbox.updateMany({
      where: { id: row.id, leaseToken, sentAt: null, deadAt: null },
      data: {
        attempts,
        lastError,
        nextAttemptAt: new Date(
          now.getTime() + BACKOFF_BASE_MS * 2 ** (attempts - 1),
        ),
        leaseToken: null,
        leaseExpiresAt: null,
      },
    });
    return settled.count === 1;
  }

  private async renewLease(id: string, leaseToken: string): Promise<boolean> {
    const now = this.clock.now();
    const renewed = await this.prisma.notificationOutbox.updateMany({
      where: {
        id,
        leaseToken,
        leaseExpiresAt: { gt: now },
        sentAt: null,
        deadAt: null,
      },
      data: { leaseExpiresAt: new Date(now.getTime() + LEASE_MS) },
    });
    return renewed.count === 1;
  }

  private async sendWithTimeout(
    input: Parameters<PushProviderPort['send']>[0],
  ): Promise<void> {
    // Текущий port не принимает AbortSignal: таймаут ограничивает worker,
    // но не обещает отмену уже переданного провайдеру запроса. Его позднее
    // завершение остаётся допустимым дублем на границе at-least-once.
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.push.send(input),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () =>
              reject(
                new Error(`push transport timeout after ${PUSH_TIMEOUT_MS}ms`),
              ),
            PUSH_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
