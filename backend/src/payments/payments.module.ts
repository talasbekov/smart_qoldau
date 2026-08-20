import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentMethodsService } from './payment-methods.service';
import { PaymentProviderPort } from './provider/payment-provider.port';
import { MockPaymentProvider } from './provider/mock-payment.provider';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [PaymentMethodsController],
  providers: [
    PaymentMethodsService,
    { provide: PaymentProviderPort, useClass: MockPaymentProvider },
  ],
  exports: [PaymentProviderPort],
})
export class PaymentsModule {}
