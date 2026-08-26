import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ClockModule } from '../common/clock/clock.module';
import { PremiumModule } from '../premium/premium.module';
import { StorageModule } from '../storage/storage.module';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { StreakService } from './streak.service';

// PremiumModule — ради пейволла: доступ к платному материалу решается
// подпиской (E12). StorageModule — ради подписанных ссылок на аудио.
@Module({
  imports: [PrismaModule, ClockModule, PremiumModule, StorageModule],
  controllers: [ContentController],
  providers: [ContentService, StreakService],
  exports: [ContentService, StreakService],
})
export class ContentModule {}
