import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { ExpertsController } from './experts.controller';
import { ExpertsService } from './experts.service';
import { ExpertGuard } from './expert.guard';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { ExpertsPublicController } from './experts-public.controller';
import { PhotoController } from './photo.controller';
import { PhotoService } from './photo.service';
import { ProfileModerationService } from './profile-moderation.service';

@Module({
  imports: [AuditModule, StorageModule],
  // Порядок важен: ExpertsController (GET /v1/experts/me) должен
  // регистрироваться раньше ExpertsPublicController (GET /v1/experts/:id),
  // иначе публичный маршрут перехватит 'me' как :id.
  controllers: [
    ExpertsController,
    PhotoController,
    DocumentsController,
    ExpertsPublicController,
  ],
  providers: [
    ExpertsService,
    ExpertGuard,
    DocumentsService,
    PhotoService,
    ProfileModerationService,
  ],
  exports: [ExpertsService, ExpertGuard, ProfileModerationService],
})
export class ExpertsModule {}
