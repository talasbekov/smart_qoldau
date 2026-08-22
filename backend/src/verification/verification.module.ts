import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    // AdminJwtGuard теперь проверяет актуальность сотрудника (E11a,
    // задача 4) и требует AdminSessionService — модуль-владелец обязан
    // быть импортирован явно.
    AdminModule,
    AuditModule,
    StorageModule,
    NotificationsModule,
  ],
  controllers: [VerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
