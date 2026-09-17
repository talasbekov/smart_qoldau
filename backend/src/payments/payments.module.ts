import { Module, forwardRef } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { PaymentsAdminController } from './payments-admin.controller';
import { PaymentOperationalSignalService } from './payment-operational-signal.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PremiumModule } from '../premium/premium.module';
import { RedisModule } from '../redis/redis.module';
import { AuditModule } from '../audit/audit.module';
import { ClockModule } from '../common/clock/clock.module';
import { ConsultationsModule } from '../consultations/consultations.module';
import { ExpertsModule } from '../experts/experts.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { EarningsController } from './earnings.controller';
import { PaymentProviderPort } from './provider/payment-provider.port';
import { MockPaymentProvider } from './provider/mock-payment.provider';
import { SettleRetryService } from './settle-retry.service';
import { PaymentsWebhookController } from './payments-webhook.controller';

// forwardRef(() => ConsultationsModule): см. комментарий в
// ConsultationsModule — PaymentsService.settle() вызывается из
// ConsultationsService.complete()/cancel() (Task 5), а PaymentsService сам
// зависит от ConsultationsService.resolveParticipant (Task 3/4) — цикл
// разрешается forwardRef с обеих сторон.
// EventsService (WsModule) — @Global(), явный импорт не нужен (см.
// ws.module.ts).
@Module({
  imports: [
    // Admin -> Chat -> Consultations -> Payments: resolve the admin guard dependency lazily.
    forwardRef(() => AdminModule),
    PrismaModule,
    RedisModule,
    AuditModule,
    ClockModule,
    forwardRef(() => ConsultationsModule),
    ExpertsModule,
    forwardRef(() => NotificationsModule),
    // Цикл: PremiumModule берёт отсюда PaymentProviderPort, а PaymentsService
    // спрашивает у PremiumService, есть ли подписка на момент оплаты.
    forwardRef(() => PremiumModule),
  ],
  controllers: [
    PaymentsAdminController,
    PaymentMethodsController,
    PaymentsController,
    EarningsController,
    PaymentsWebhookController,
  ],
  providers: [
    PaymentOperationalSignalService,
    PaymentMethodsService,
    PaymentsService,
    { provide: PaymentProviderPort, useClass: MockPaymentProvider },
    SettleRetryService,
  ],
  exports: [PaymentProviderPort, PaymentsService, SettleRetryService],
})
export class PaymentsModule {}
