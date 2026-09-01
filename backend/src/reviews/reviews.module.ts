import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ConsultationsModule } from '../consultations/consultations.module';
import { ExpertsModule } from '../experts/experts.module';
import { ReviewsService } from './reviews.service';
import {
  ConsultationReviewController,
  ExpertReviewsController,
  MyExpertReviewsController,
  ReviewsController,
} from './reviews.controller';
import { ReviewsAdminController } from './reviews-admin.controller';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    // AdminJwtGuard теперь проверяет актуальность сотрудника (E11a,
    // задача 4) и требует AdminSessionService — модуль-владелец обязан
    // быть импортирован явно.
    AdminModule,
    PrismaModule,
    AuditModule,
    ConsultationsModule,
    ExpertsModule,
  ],
  controllers: [
    ConsultationReviewController,
    ReviewsController,
    // Порядок важен: MyExpertReviewsController (GET /v1/experts/me/reviews)
    // должен регистрироваться раньше ExpertReviewsController (GET
    // /v1/experts/:id/reviews), иначе тот перехватит 'me' как :id.
    MyExpertReviewsController,
    ExpertReviewsController,
    ReviewsAdminController,
  ],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
