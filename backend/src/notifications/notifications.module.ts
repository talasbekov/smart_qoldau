import { forwardRef, Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ClockModule } from '../common/clock/clock.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PushProviderPort } from './provider/push-provider.port';
import { MockPushProvider } from './provider/mock-push.provider';
import { OfferPushFallbackService } from './offer-push-fallback.service';
import { SmsBudgetService } from './sms-budget.service';
import { OutboxService } from './outbox.service';
import { OutboxSweepService } from './outbox-sweep.service';
import { NotificationsAdminController } from './notifications-admin.controller';
import { PushObservationService } from './push-observation.service';

// EventsService — @Global() WsModule, явный импорт не нужен. AuthModule —
// источник SMS_PROVIDER_TOKEN (SMS-fallback критичных уведомлений, задача 5).
@Module({
  imports: [
    // Admin -> Chat -> Consultations -> Payments -> Notifications.
    // Resolve the admin-guard dependency without changing that graph.
    forwardRef(() => AdminModule),
    PrismaModule,
    RedisModule,
    ClockModule,
    AuditModule,
    AuthModule,
  ],
  controllers: [NotificationsController, NotificationsAdminController],
  providers: [
    NotificationsService,
    PushObservationService,
    OfferPushFallbackService,
    SmsBudgetService,
    OutboxService,
    OutboxSweepService,
    { provide: PushProviderPort, useClass: MockPushProvider },
  ],
  exports: [
    NotificationsService,
    OfferPushFallbackService,
    SmsBudgetService,
    OutboxService,
    OutboxSweepService,
  ],
})
export class NotificationsModule {}
