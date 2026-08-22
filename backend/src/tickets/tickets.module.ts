import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ClockModule } from '../common/clock/clock.module';
import { ExpertsModule } from '../experts/experts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { TicketsAdminController } from './tickets-admin.controller';
import { AdminModule } from '../admin/admin.module';

// JwtStrategy — провайдер AuthModule, регистрируется в passport глобально
// при старте приложения (как и для остальных модулей с JwtAuthGuard —
// ReviewsModule/PayoutsModule и т.д.), явный импорт AuthModule здесь не
// нужен. А вот AdminModule с задачи 4 эпика E11a импортировать ОБЯЗАТЕЛЬНО:
// AdminJwtGuard перестал быть stateless и требует AdminSessionService —
// без импорта модуля-владельца guard не резолвится и запрос падает 500.
// NotificationsModule — dispatch() уведомления ticket.replied автору после
// ответа сотрудника (задача 9, см. TicketsService.reply).
@Module({
  imports: [
    AdminModule,
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
