import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// Алиас: избегаем коллизии имён с доменным ./schedule/schedule.module
// (расписание эксперта, БП-05) — это модуль @nestjs/schedule (@Interval/@Cron).
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
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
import { RequestsModule } from './requests/requests.module';
import { WsModule } from './ws/ws.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    NestScheduleModule.forRoot(),
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
    WsModule,
    RequestsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
