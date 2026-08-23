import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ExpertsModule } from '../experts/experts.module';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { ScheduleExceptionsController } from './schedule-exceptions.controller';
import { ScheduleExceptionsService } from './schedule-exceptions.service';

@Module({
  imports: [AuditModule, ExpertsModule],
  // Порядок важен: конкретный маршрут исключений регистрируется раньше,
  // чем общий ScheduleController с `schedule`.
  controllers: [ScheduleExceptionsController, ScheduleController],
  providers: [ScheduleService, ScheduleExceptionsService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
