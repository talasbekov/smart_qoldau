import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AdminBootstrapService } from './admin-bootstrap.service';

@Module({
  imports: [AuditModule],
  providers: [AdminBootstrapService],
})
export class AdminModule {}
