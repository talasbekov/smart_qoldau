import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SlotsController } from './slots.controller';
import { SlotsService } from './slots.service';

// Вычисление слотов (E6b). Запись на слот (BookingService/Controller)
// живёт в ConsultationsModule: она опирается на PaymentsService, а
// Payments и Consultations уже связаны forwardRef-циклом — третий модуль,
// входящий в этот цикл, роняет разрешение зависимостей Nest.
@Module({
  imports: [AuditModule],
  controllers: [SlotsController],
  providers: [SlotsService],
  exports: [SlotsService],
})
export class BookingModule {}
