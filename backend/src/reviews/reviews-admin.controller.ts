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
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { AdminJwtGuard } from '../admin/admin-jwt.guard';
import { RolesGuard } from '../admin/roles.guard';
import { Roles } from '../admin/roles.decorator';
import {
  CurrentAdmin,
  CurrentAdminPayload,
} from '../admin/current-admin.decorator';
import { FlaggedReviewDto } from './dto/flagged-review.dto';
import { ResolveReviewDto } from './dto/resolve-review.dto';

@ApiTags('admin-reviews')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
@Controller('admin/reviews')
export class ReviewsAdminController {
  constructor(private reviews: ReviewsService) {}

  @Get('flagged')
  @Roles(AdminRole.QUALITY_TEAM)
  @ApiOperation({
    summary:
      'Очередь FLAGGED-отзывов на модерацию (админ видит всё, включая privateText)',
  })
  @ApiOkResponse({ type: FlaggedReviewDto, isArray: true })
  async flagged(): Promise<FlaggedReviewDto[]> {
    return this.reviews.listFlagged();
  }

  @Post(':id/resolve')
  @Roles(AdminRole.QUALITY_TEAM)
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
    @CurrentAdmin() admin: CurrentAdminPayload,
  ): Promise<void> {
    await this.reviews.resolve(id, dto, admin.id);
  }
}
