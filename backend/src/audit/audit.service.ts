import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorType: 'user' | 'expert' | 'admin' | 'system';
  actorId?: string | null;
  entity: string;
  entityId: string;
  transition: string;
  payload?: object;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

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
}
