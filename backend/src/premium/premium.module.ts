import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ClockModule } from '../common/clock/clock.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { PremiumController } from './premium.controller';
import { PremiumService } from './premium.service';
import { PremiumRenewalService } from './premium-renewal.service';

// PaymentsModule — ради PaymentProviderPort: подписка списывает деньги тем
// же провайдером, что и консультации. LedgerModule @Global(), явный импорт
// не нужен.
@Module({
  imports: [
    PrismaModule,
    AuditModule,
    ClockModule,
    NotificationsModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [PremiumController],
  providers: [PremiumService, PremiumRenewalService],
  exports: [PremiumService, PremiumRenewalService],
})
export class PremiumModule {}
