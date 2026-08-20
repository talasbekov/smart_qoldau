import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ClockModule } from '../common/clock/clock.module';
import { PresenceModule } from '../presence/presence.module';
import { ExpertsModule } from '../experts/experts.module';
import { RedisModule } from '../redis/redis.module';
import { ConsultationsService } from './consultations.service';
import { ConsultationsController } from './consultations.controller';
import { NoShowService } from './no-show.service';

// Односторонняя зависимость: ConsultationsModule НЕ импортирует
// RequestsModule (во избежание циклической зависимости) — RequestsModule
// импортирует ConsultationsModule и вызывает createFromMatch напрямую.
// WsModule НЕ импортируется явно: он @Global() (см. ws/ws.module.ts) и сам
// импортирует ChatModule -> ConsultationsModule — явный импорт здесь создал
// бы цикл WsModule -> ChatModule -> ConsultationsModule -> WsModule.
// EventsService доступен через глобальный контейнер без импорта.
@Module({
  imports: [
    PrismaModule,
    AuditModule,
    ClockModule,
    PresenceModule,
    ExpertsModule,
    RedisModule,
  ],
  controllers: [ConsultationsController],
  providers: [ConsultationsService, NoShowService],
  exports: [ConsultationsService, NoShowService],
})
export class ConsultationsModule {}
