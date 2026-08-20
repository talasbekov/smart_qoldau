import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ConsultationsModule } from '../consultations/consultations.module';
import { ReviewsService } from './reviews.service';
import {
  ConsultationReviewController,
  ExpertReviewsController,
  ReviewsController,
} from './reviews.controller';

@Module({
  imports: [PrismaModule, AuditModule, ConsultationsModule],
  controllers: [
    ConsultationReviewController,
    ReviewsController,
    ExpertReviewsController,
  ],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
