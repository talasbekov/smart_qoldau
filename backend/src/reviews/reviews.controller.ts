import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ListExpertReviewsDto } from './dto/list-expert-reviews.dto';
import { ExpertReviewsDto } from './dto/expert-reviews.dto';
import { ReviewCreatedDto } from './dto/review-created.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller('consultations')
@UseGuards(JwtAuthGuard)
export class ConsultationReviewController {
  constructor(private reviews: ReviewsService) {}

  @Post(':id/review')
  @ApiOperation({
    summary:
      'Клиент оставляет отзыв на завершённую консультацию (COMPLETED, outcome COMPLETED)',
  })
  @ApiOkResponse({ description: 'Отзыв создан', type: ReviewCreatedDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — не клиент-участник' })
  @ApiNotFoundResponse({ description: 'CONSULTATION_NOT_FOUND' })
  @ApiConflictResponse({
    description: 'CONSULTATION_NOT_COMPLETED | REVIEW_EXISTS',
  })
  async create(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewCreatedDto> {
    return this.reviews.create(id, user.sub, dto);
  }
}

@ApiTags('reviews')
@ApiBearerAuth()
@Controller('reviews')
@UseGuards(JwtAuthGuard)
export class ReviewsController {
  constructor(private reviews: ReviewsService) {}

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Удаление своего отзыва автором-клиентом' })
  @ApiNoContentResponse({ description: 'Отзыв удалён' })
  @ApiNotFoundResponse({ description: 'REVIEW_NOT_FOUND' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<void> {
    await this.reviews.remove(id, user.sub);
  }
}

// Публичный эндпоинт (без auth) — вынесен отдельным контроллером под
// /v1/experts/:id/reviews, регистрируется в ReviewsModule.
@ApiTags('reviews')
@Controller('experts')
export class ExpertReviewsController {
  constructor(private reviews: ReviewsService) {}

  @Get(':id/reviews')
  @ApiOperation({
    summary:
      'Публичные отзывы эксперта (PUBLISHED), автор анонимен, распределение 1..5',
  })
  @ApiOkResponse({ type: ExpertReviewsDto })
  async list(
    @Param('id') id: string,
    @Query() filters: ListExpertReviewsDto,
  ): Promise<ExpertReviewsDto> {
    return this.reviews.listForExpert(id, filters);
  }
}
