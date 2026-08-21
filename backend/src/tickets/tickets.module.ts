import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ClockModule } from '../common/clock/clock.module';
import { ExpertsModule } from '../experts/experts.module';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';

// JwtStrategy — провайдер AuthModule, регистрируется в passport глобально
// при старте приложения (как и для остальных модулей с JwtAuthGuard —
// ReviewsModule/PayoutsModule и т.д.), явный импорт AuthModule здесь не
// нужен.
@Module({
  imports: [PrismaModule, AuditModule, ClockModule, ExpertsModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
