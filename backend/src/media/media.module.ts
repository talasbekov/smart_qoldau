import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ConsultationsModule } from '../consultations/consultations.module';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { LivekitWebhookController } from './livekit-webhook.controller';

@Module({
  imports: [PrismaModule, AuditModule, ConsultationsModule],
  controllers: [MediaController, LivekitWebhookController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
