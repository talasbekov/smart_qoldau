import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AuditModule } from '../audit/audit.module';
import { ClockModule } from '../common/clock/clock.module';
import { ConsultationsModule } from '../consultations/consultations.module';
import { ExpertsModule } from '../experts/experts.module';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { EarningsController } from './earnings.controller';
import { PaymentProviderPort } from './provider/payment-provider.port';
import { MockPaymentProvider } from './provider/mock-payment.provider';

// forwardRef(() => ConsultationsModule): см. комментарий в
// ConsultationsModule — PaymentsService.settle() вызывается из
// ConsultationsService.complete()/cancel() (Task 5), а PaymentsService сам
// зависит от ConsultationsService.resolveParticipant (Task 3/4) — цикл
// разрешается forwardRef с обеих сторон.
@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuditModule,
    ClockModule,
    forwardRef(() => ConsultationsModule),
    ExpertsModule,
  ],
  controllers: [
    PaymentMethodsController,
    PaymentsController,
    EarningsController,
  ],
  providers: [
    PaymentMethodsService,
    PaymentsService,
    { provide: PaymentProviderPort, useClass: MockPaymentProvider },
  ],
  exports: [PaymentProviderPort, PaymentsService],
})
export class PaymentsModule {}
