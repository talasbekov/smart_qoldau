import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ClockModule } from '../common/clock/clock.module';
import { PresenceModule } from '../presence/presence.module';
import { ExpertsModule } from '../experts/experts.module';
import { WsModule } from '../ws/ws.module';
import { ConsultationsService } from './consultations.service';
import { ConsultationsController } from './consultations.controller';

// Односторонняя зависимость: ConsultationsModule НЕ импортирует
// RequestsModule (во избежание циклической зависимости) — RequestsModule
// импортирует ConsultationsModule и вызывает createFromMatch напрямую.
@Module({
  imports: [
    PrismaModule,
    AuditModule,
    ClockModule,
    PresenceModule,
    ExpertsModule,
    WsModule,
  ],
  controllers: [ConsultationsController],
  providers: [ConsultationsService],
  exports: [ConsultationsService],
})
export class ConsultationsModule {}
