import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ExpertsController } from './experts.controller';
import { ExpertsService } from './experts.service';
import { ExpertGuard } from './expert.guard';

@Module({
  imports: [AuditModule],
  controllers: [ExpertsController],
  providers: [ExpertsService, ExpertGuard],
  exports: [ExpertsService],
})
export class ExpertsModule {}
