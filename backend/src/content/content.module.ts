import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ClockModule } from '../common/clock/clock.module';
import { PremiumModule } from '../premium/premium.module';
import { StorageModule } from '../storage/storage.module';
import { AdminModule } from '../admin/admin.module';
import { AuditModule } from '../audit/audit.module';
import { ContentController } from './content.controller';
import { ContentAdminController } from './content-admin.controller';
import { ContentAdminService } from './content-admin.service';
import { ContentService } from './content.service';
import { StreakService } from './streak.service';

// PremiumModule — ради пейволла: доступ к платному материалу решается
// подпиской (E12). StorageModule — ради подписанных ссылок на аудио.
@Module({
  imports: [
    PrismaModule,
    ClockModule,
    AuditModule,
    // Обязателен: AdminJwtGuard на CMS-эндпоинтах спрашивает у
    // AdminSessionService, жив ли ещё сотрудник и не отозваны ли его права.
    AdminModule,
    PremiumModule,
    StorageModule,
  ],
  controllers: [ContentController, ContentAdminController],
  providers: [ContentService, StreakService, ContentAdminService],
  exports: [ContentService, StreakService],
})
export class ContentModule {}
