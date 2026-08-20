import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AuditModule } from '../audit/audit.module';
import { ClockModule } from '../common/clock/clock.module';
import { ConsultationsModule } from '../consultations/consultations.module';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentProviderPort } from './provider/payment-provider.port';
import { MockPaymentProvider } from './provider/mock-payment.provider';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AuditModule,
    ClockModule,
    ConsultationsModule,
  ],
  controllers: [PaymentMethodsController, PaymentsController],
  providers: [
    PaymentMethodsService,
    PaymentsService,
    { provide: PaymentProviderPort, useClass: MockPaymentProvider },
  ],
  exports: [PaymentProviderPort],
})
export class PaymentsModule {}
