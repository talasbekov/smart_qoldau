import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { AdminModule } from '../admin/admin.module';
import { ExpertsModule } from '../experts/experts.module';
import { ProfileModerationController } from './profile-moderation.controller';
import { ProfileModerationQueueService } from './profile-moderation-queue.service';

@Module({
  imports: [
    // AdminJwtGuard теперь проверяет актуальность сотрудника (E11a,
    // задача 4) и требует AdminSessionService — модуль-владелец обязан
    // быть импортирован явно.
    AdminModule,
    AuditModule,
    StorageModule,
    NotificationsModule,
    // ProfileModerationService — общая машина переходов, её владелец
    // ExpertsModule (E2a, задача 5).
    ExpertsModule,
  ],
  controllers: [VerificationController, ProfileModerationController],
  providers: [VerificationService, ProfileModerationQueueService],
})
export class VerificationModule {}
