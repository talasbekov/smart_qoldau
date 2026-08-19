import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ClockModule } from '../common/clock/clock.module';
import { MatchingModule } from '../matching/matching.module';
import { ExpertsModule } from '../experts/experts.module';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { OffersController } from './offers.controller';
import { NoopOfferTimer, OFFER_TIMER_REGISTRY } from './offer-timer.registry';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    ClockModule,
    MatchingModule,
    ExpertsModule,
  ],
  controllers: [RequestsController, OffersController],
  providers: [
    RequestsService,
    { provide: OFFER_TIMER_REGISTRY, useClass: NoopOfferTimer },
  ],
  exports: [RequestsService],
})
export class RequestsModule {}
