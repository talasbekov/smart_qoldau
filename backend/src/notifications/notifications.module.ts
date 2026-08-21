import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { ClockModule } from '../common/clock/clock.module';
import { NotificationsService } from './notifications.service';
import { PushProviderPort } from './provider/push-provider.port';
import { MockPushProvider } from './provider/mock-push.provider';

// EventsService — @Global() WsModule, явный импорт не нужен.
@Module({
  imports: [PrismaModule, RedisModule, ClockModule],
  providers: [
    NotificationsService,
    { provide: PushProviderPort, useClass: MockPushProvider },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
