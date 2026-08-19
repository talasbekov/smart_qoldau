import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ExpertsController } from './experts.controller';
import { ExpertsService } from './experts.service';
import { ExpertGuard } from './expert.guard';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [AuditModule],
  controllers: [ExpertsController, DocumentsController],
  providers: [ExpertsService, ExpertGuard, DocumentsService],
  exports: [ExpertsService, ExpertGuard],
})
export class ExpertsModule {}
