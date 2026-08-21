import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    const created = await this.prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        roles: ['SUPERADMIN'],
      },
    });

    await this.audit.log({
      actorType: 'system',
      entity: 'staff',
      entityId: created.id,
      transition: 'staff.created',
      payload: { email: created.email, roles: created.roles },
    });

    this.logger.log(`Создан первый суперадмин: ${created.email}`);
    return 'created';
  }
}
