import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PresenceModule } from '../presence/presence.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { ClockModule } from '../common/clock/clock.module';
import { MatchingService } from './matching.service';
import { ScoringService } from './scoring.service';

@Module({
  imports: [PrismaModule, PresenceModule, ScheduleModule, ClockModule],
  providers: [MatchingService, ScoringService],
  exports: [MatchingService, ScoringService],
})
export class MatchingModule {}
