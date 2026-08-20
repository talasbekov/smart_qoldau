import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { AdminTokenGuard } from '../verification/admin-token.guard';
import { FlaggedReviewDto } from './dto/flagged-review.dto';
import { ResolveReviewDto } from './dto/resolve-review.dto';

@ApiTags('admin-reviews')
@ApiHeader({
  name: 'X-Admin-Token',
  description: 'Временный админ-токен до RBAC (эпик E8)',
  required: true,
})
@UseGuards(AdminTokenGuard)
@ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
@Controller('admin/reviews')
export class ReviewsAdminController {
  constructor(private reviews: ReviewsService) {}

  @Get('flagged')
  @ApiOperation({
    summary:
      'Очередь FLAGGED-отзывов на модерацию (админ видит всё, включая privateText)',
  })
  @ApiOkResponse({ type: FlaggedReviewDto, isArray: true })
  async flagged(): Promise<FlaggedReviewDto[]> {
    return this.reviews.listFlagged();
  }

  @Post(':id/resolve')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Решение по FLAGGED-отзыву: hide -> HIDDEN | restore -> PUBLISHED, пересчёт агрегатов',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Решение зафиксировано' })
  @ApiNotFoundResponse({ description: 'REVIEW_NOT_FOUND' })
  @ApiConflictResponse({ description: 'INVALID_STATE_TRANSITION' })
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveReviewDto,
  ): Promise<void> {
    await this.reviews.resolve(id, dto);
  }
}
