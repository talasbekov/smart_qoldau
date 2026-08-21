import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ClockModule } from '../common/clock/clock.module';
import { ExpertsModule } from '../experts/experts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { TicketsAdminController } from './tickets-admin.controller';

// JwtStrategy — провайдер AuthModule, регистрируется в passport глобально
// при старте приложения (как и для остальных модулей с JwtAuthGuard —
// ReviewsModule/PayoutsModule и т.д.), явный импорт AuthModule здесь не
// нужен. По той же причине не нужен явный импорт AdminModule для
// AdminJwtGuard/RolesGuard в TicketsAdminController (задача 8) — оба guard'а
// используют глобально зарегистрированную passport-стратегию 'jwt' и
// Reflector из @nestjs/core (см. PayoutsModule/ReviewsModule).
// NotificationsModule — dispatch() уведомления ticket.replied автору после
// ответа сотрудника (задача 9, см. TicketsService.reply).
@Module({
  imports: [
    PrismaModule,
    AuditModule,
    ClockModule,
    ExpertsModule,
    NotificationsModule,
  ],
  controllers: [TicketsController, TicketsAdminController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
