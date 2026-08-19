import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ClockModule } from '../common/clock/clock.module';
import { MatchingModule } from '../matching/matching.module';
import { ExpertsModule } from '../experts/experts.module';
import { RedisModule } from '../redis/redis.module';
import { WsModule } from '../ws/ws.module';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { OffersController } from './offers.controller';
import { OFFER_TIMER_REGISTRY } from './offer-timer.registry';
import { OfferTimerService } from './offer-timer.service';
import { EscalationService } from './escalation.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    ClockModule,
    MatchingModule,
    ExpertsModule,
    RedisModule,
    WsModule,
  ],
  controllers: [RequestsController, OffersController],
  providers: [
    RequestsService,
    OfferTimerService,
    EscalationService,
    { provide: OFFER_TIMER_REGISTRY, useExisting: OfferTimerService },
  ],
  exports: [RequestsService, OfferTimerService, EscalationService],
})
export class RequestsModule {}
