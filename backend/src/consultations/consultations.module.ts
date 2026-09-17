import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ClockModule } from '../common/clock/clock.module';
import { PresenceModule } from '../presence/presence.module';
import { ExpertsModule } from '../experts/experts.module';
import { RedisModule } from '../redis/redis.module';
import { ChatModule } from '../chat/chat.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConsultationsService } from './consultations.service';
import { BookingModule } from '../booking/booking.module';
import { BookingController } from '../booking/booking.controller';
import { BookingService } from '../booking/booking.service';
import { ConsultationsController } from './consultations.controller';
import { NotesController } from './notes.controller';
import { NoShowService } from './no-show.service';
import { ScheduledSweepService } from './scheduled-sweep.service';

// Односторонняя зависимость: ConsultationsModule НЕ импортирует
// RequestsModule (во избежание циклической зависимости) — RequestsModule
// импортирует ConsultationsModule и вызывает createFromMatch напрямую.
// WsModule НЕ импортируется явно: он @Global() (см. ws/ws.module.ts) и сам
// импортирует ChatModule -> ConsultationsModule — явный импорт здесь создал
// бы цикл WsModule -> ChatModule -> ConsultationsModule -> WsModule.
// EventsService доступен через глобальный контейнер без импорта.
// PaymentsModule — forwardRef в обе стороны: PaymentsModule импортирует
// ConsultationsModule (resolveParticipant для pay/getStatus),
// ConsultationsService вызывает PaymentsService.settle() из complete/cancel
// (Task 5) — классический цикл двух доменных модулей, разрешается через
// forwardRef с обеих сторон.
@Module({
  imports: [
    PrismaModule,
    AuditModule,
    ClockModule,
    PresenceModule,
    ExpertsModule,
    RedisModule,
    forwardRef(() => ChatModule),
    forwardRef(() => PaymentsModule),
    forwardRef(() => NotificationsModule),
    // Слоты для записи (E6b): BookingService живёт здесь, потому что ему
    // нужен PaymentsService, а Payments↔Consultations уже связаны
    // forwardRef — третий участник цикла ломает разрешение зависимостей.
    BookingModule,
  ],
  controllers: [ConsultationsController, NotesController, BookingController],
  providers: [
    ConsultationsService,
    NoShowService,
    BookingService,
    ScheduledSweepService,
  ],
  exports: [ScheduledSweepService, ConsultationsService, NoShowService],
})
export class ConsultationsModule {}
