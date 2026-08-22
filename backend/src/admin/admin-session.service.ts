import { Injectable } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

// Актуальность сотрудника на КАЖДОМ запросе (E11a, задача 4).
//
// До этой задачи авторизация админки была полностью stateless: подпись
// токена проверена — значит, доступ есть. Деактивированный сотрудник
// продолжал работать до истечения access-токена (15 минут), а снятая роль
// не действовала вовсе, потому что роли брались из payload'а.
//
// Ходить в БД на каждый запрос ради этого не нужно: состояние кэшируется в
// Redis на несколько секунд. Кэш общий для реплик — иначе отзыв доступа
// срабатывал бы на одной реплике и не срабатывал на другой.
export interface AdminState {
  isActive: boolean;
  roles: AdminRole[];
}

const CACHE_PREFIX = 'admin:state:';

@Injectable()
export class AdminSessionService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private config: ConfigService,
  ) {}

  private get cacheTtlSec(): number {
    return Number(this.config.get('ADMIN_CHECK_CACHE_SEC', '30'));
  }

  /// Текущее состояние сотрудника. `null` — сотрудника нет вовсе.
  async stateOf(adminUserId: string): Promise<AdminState | null> {
    const key = `${CACHE_PREFIX}${adminUserId}`;
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached) as AdminState;

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminUserId },
      select: { isActive: true, roles: true },
    });
    if (!admin) return null;

    const state: AdminState = { isActive: admin.isActive, roles: admin.roles };
    await this.redis.set(key, JSON.stringify(state), 'EX', this.cacheTtlSec);
    return state;
  }

  /// Сбрасывает кэш — вызывается при любом изменении сотрудника, чтобы
  /// отзыв доступа не ждал истечения TTL.
  async invalidate(adminUserId: string): Promise<void> {
    await this.redis.del(`${CACHE_PREFIX}${adminUserId}`);
  }
}
