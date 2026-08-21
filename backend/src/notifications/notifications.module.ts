import { Module } from '@nestjs/common';
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

// EventsService — @Global() WsModule, явный импорт не нужен. AuthModule —
// источник SMS_PROVIDER_TOKEN (SMS-fallback критичных уведомлений, задача 5).
@Module({
  imports: [PrismaModule, RedisModule, ClockModule, AuditModule, AuthModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    OfferPushFallbackService,
    { provide: PushProviderPort, useClass: MockPushProvider },
  ],
  exports: [NotificationsService, OfferPushFallbackService],
})
export class NotificationsModule {}
