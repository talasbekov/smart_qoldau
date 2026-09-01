import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface AuditEntry {
  actorType: 'user' | 'expert' | 'admin' | 'system';
  actorId?: string | null;
  entity: string;
  entityId: string;
  transition: string;
  payload?: object;
}

// Окно схлопывания повторных обращений одного актора к одному объекту
// (ТЗ §11.7, «логи доступа к метаданным консультаций»). Смысл лога —
// «кто и когда смотрел», а не счётчик HTTP-запросов: экран консультации
// перезапрашивает метаданные при каждом возврате в него, и без окна
// audit_log за сутки распухал бы на порядки без единицы новой информации.
// 5 минут ≈ длина одного «сеанса просмотра».
const ACCESS_DEDUP_TTL_SEC = 300;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: entry,
      });
    } catch (e) {
      this.logger.error(
        `Failed to write audit log for ${entry.entity}.${entry.transition}: ${e instanceof Error ? e.message : String(e)}`,
        e instanceof Error ? e.stack : '',
      );
    }
  }

  // Лог ЧТЕНИЯ (в отличие от [log] — лога переходов состояний). Пишет не
  // чаще одной записи на (актор, объект, вид доступа) в окне
  // ACCESS_DEDUP_TTL_SEC.
  //
  // Fail-open: если Redis недоступен, запись всё равно уходит в audit_log.
  // Обратный выбор (fail-closed) означал бы, что падение кэша молча
  // выключает журнал доступа к персональным данным — это хуже, чем
  // несколько лишних строк.
  async logAccess(entry: AuditEntry): Promise<void> {
    // actorType в ключе не декоративен: один и тот же человек может
    // читать один и тот же объект и как клиент, и как эксперт (аккаунт
    // эксперта — это тот же user), и это разные обращения.
    const key = `audit:access:${entry.actorType}:${entry.actorId ?? 'anon'}:${entry.transition}:${entry.entityId}`;
    try {
      const claimed = await this.redis.set(
        key,
        '1',
        'EX',
        ACCESS_DEDUP_TTL_SEC,
        'NX',
      );
      if (claimed === null) return;
    } catch (e) {
      this.logger.warn(
        `Access-log dedup unavailable (${e instanceof Error ? e.message : String(e)}), writing anyway`,
      );
    }
    await this.log(entry);
  }
}
