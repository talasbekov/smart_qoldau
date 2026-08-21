import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const BCRYPT_ROUNDS = 10; // как в auth.service.ts (хеш кода из SMS)

// Первый суперадмин — иначе систему некому включить (эпик E8a). Сид
// идемпотентен: пропускается, если таблица admin_users уже не пуста, и не
// требует env-переменных для боевого деплоя без сида (ADMIN_BOOTSTRAP_EMAIL
// / ADMIN_BOOTSTRAP_PASSWORD опциональны).
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  onModuleInit(): Promise<'created' | 'skipped'> {
    return this.seedIfEmpty();
  }

  async seedIfEmpty(): Promise<'created' | 'skipped'> {
    const count = await this.prisma.adminUser.count();
    if (count > 0) return 'skipped';

    const email = this.config.get<string>('ADMIN_BOOTSTRAP_EMAIL');
    const password = this.config.get<string>('ADMIN_BOOTSTRAP_PASSWORD');
    if (!email || !password) return 'skipped';

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    let created;
    try {
      created = await this.prisma.adminUser.create({
        data: {
          email,
          passwordHash,
          roles: ['SUPERADMIN'],
        },
      });
    } catch (error) {
      // Гонка параллельного старта: между count()=0 этого инстанса и его
      // create() другая реплика (тот же деплой, count()=0 у неё тоже) уже
      // создала первого суперадмина -> P2002 на уникальном email/единственной
      // строке. Сид идемпотентен ПО СМЫСЛУ (нужен ровно один суперадмин) —
      // трактуем конфликт как skipped, а не даём ему уронить onModuleInit
      // и не поднять инстанс вовсе.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.logger.log(
          'Суперадмин уже создан параллельно стартующей репликой — пропускаю',
        );
        return 'skipped';
      }
      throw error;
    }

    await this.audit.log({
      actorType: 'admin',
      entity: 'staff',
      entityId: created.id,
      transition: 'staff.created',
      payload: { email: created.email, roles: created.roles },
    });

    this.logger.log(`Создан первый суперадмин: ${created.email}`);
    return 'created';
  }
}
