import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { TopicsModule } from './topics/topics.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';
import { PresenceModule } from './presence/presence.module';
import { ExpertsModule } from './experts/experts.module';
import { VerificationModule } from './verification/verification.module';
import { ScheduleModule } from './schedule/schedule.module';
import { ClockModule } from './common/clock/clock.module';
import { MatchingModule } from './matching/matching.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    ClockModule,
    PrismaModule,
    RedisModule,
    AuditModule,
    TopicsModule,
    AuthModule,
    StorageModule,
    PresenceModule,
    ExpertsModule,
    VerificationModule,
    ScheduleModule,
    MatchingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
