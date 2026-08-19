import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { AdminTokenGuard } from './admin-token.guard';

@Module({
  imports: [AuditModule, StorageModule],
  controllers: [VerificationController],
  providers: [VerificationService, AdminTokenGuard],
})
export class VerificationModule {}
