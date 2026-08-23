import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ClockModule } from '../common/clock/clock.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RetentionSweepService } from './retention-sweep.service';

// Эксплуатационная уборка (E11a, задача 10).
@Module({
  imports: [PrismaModule, ClockModule, AuditModule],
  providers: [RetentionSweepService],
  exports: [RetentionSweepService],
})
export class MaintenanceModule {}
