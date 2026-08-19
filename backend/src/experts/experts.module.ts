import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ExpertsController } from './experts.controller';
import { ExpertsService } from './experts.service';
import { ExpertGuard } from './expert.guard';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { ExpertsPublicController } from './experts-public.controller';

@Module({
  imports: [AuditModule],
  // Порядок важен: ExpertsController (GET /v1/experts/me) должен
  // регистрироваться раньше ExpertsPublicController (GET /v1/experts/:id),
  // иначе публичный маршрут перехватит 'me' как :id.
  controllers: [
    ExpertsController,
    DocumentsController,
    ExpertsPublicController,
  ],
  providers: [ExpertsService, ExpertGuard, DocumentsService],
  exports: [ExpertsService, ExpertGuard],
})
export class ExpertsModule {}
