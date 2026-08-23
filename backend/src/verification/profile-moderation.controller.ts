import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../admin/admin-jwt.guard';
import { RolesGuard } from '../admin/roles.guard';
import { Roles } from '../admin/roles.decorator';
import {
  CurrentAdmin,
  CurrentAdminPayload,
} from '../admin/current-admin.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  ModerationDecisionDto,
  ModerationQueueDto,
} from './dto/moderation-queue.dto';
import { ProfileModerationQueueService } from './profile-moderation-queue.service';

// Фото и текст «о себе» относятся к достоверности профиля, поэтому роль та
// же, что у документов верификации.
@ApiTags('admin-profile-moderation')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@Roles(AdminRole.VERIFICATION_OPERATOR)
@ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
@ApiForbiddenResponse({ description: 'FORBIDDEN — недостаточно прав' })
@Controller('admin/profile-moderation')
export class ProfileModerationController {
  constructor(private queueService: ProfileModerationQueueService) {}

  @Get()
  @ApiOperation({ summary: 'Очередь фотографий и текстов на модерацию' })
  @ApiOkResponse({ type: ModerationQueueDto })
  queue(@Query() query: PaginationQueryDto): Promise<ModerationQueueDto> {
    return this.queueService.queue(query);
  }

  @Post(':expertId/photo/decision')
  @HttpCode(200)
  @ApiOperation({ summary: 'Решение по фотографии: approve/reject' })
  @ApiParam({ name: 'expertId', format: 'uuid' })
  @ApiOkResponse({ description: 'Решение зафиксировано' })
  @ApiBadRequestResponse({ description: 'MODERATION_COMMENT_REQUIRED' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  @ApiConflictResponse({ description: 'NOTHING_TO_MODERATE' })
  photoDecision(
    @Param('expertId') expertId: string,
    @Body() dto: ModerationDecisionDto,
    @CurrentAdmin() admin: CurrentAdminPayload,
  ): Promise<void> {
    return this.queueService.decide(expertId, 'photo', dto, admin.id);
  }

  @Post(':expertId/about/decision')
  @HttpCode(200)
  @ApiOperation({ summary: 'Решение по тексту «о себе»: approve/reject' })
  @ApiParam({ name: 'expertId', format: 'uuid' })
  @ApiOkResponse({ description: 'Решение зафиксировано' })
  @ApiBadRequestResponse({ description: 'MODERATION_COMMENT_REQUIRED' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  @ApiConflictResponse({ description: 'NOTHING_TO_MODERATE' })
  aboutDecision(
    @Param('expertId') expertId: string,
    @Body() dto: ModerationDecisionDto,
    @CurrentAdmin() admin: CurrentAdminPayload,
  ): Promise<void> {
    return this.queueService.decide(expertId, 'about', dto, admin.id);
  }
}
