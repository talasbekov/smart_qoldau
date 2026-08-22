import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AuditModule } from '../audit/audit.module';
import { ClockModule } from '../common/clock/clock.module';
import { ExpertsModule } from '../experts/experts.module';
import { PaymentsModule } from '../payments/payments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PayoutsService } from './payouts.service';
import { PayoutsController } from './payouts.controller';
import { PayoutsAdminController } from './payouts-admin.controller';
import { PayoutsWebhookController } from './payouts-webhook.controller';
import { PayoutProviderPort } from './provider/payout-provider.port';
import { MockPayoutProvider } from './provider/mock-payout.provider';
import { AdminModule } from '../admin/admin.module';

// PaymentsModule — ради PaymentProviderPort.tokenizeCard (карта вывода
// токенизируется той же карточной инфраструктурой, что и карты оплаты).
// LedgerService/EventsService — @Global()-модули, явный импорт не нужен.
@Module({
  imports: [
    // AdminJwtGuard теперь проверяет актуальность сотрудника (E11a,
    // задача 4) и требует AdminSessionService — модуль-владелец обязан
    // быть импортирован явно.
    AdminModule,
    PrismaModule,
    RedisModule,
    AuditModule,
    ClockModule,
    ExpertsModule,
    PaymentsModule,
    NotificationsModule,
  ],
  controllers: [
    PayoutsController,
    PayoutsAdminController,
    PayoutsWebhookController,
  ],
  providers: [
    PayoutsService,
    { provide: PayoutProviderPort, useClass: MockPayoutProvider },
  ],
  exports: [PayoutsService],
})
export class PayoutsModule {}
