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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminRole, Expert } from '@prisma/client';
import { VerificationService } from './verification.service';
import { AdminJwtGuard } from '../admin/admin-jwt.guard';
import { RolesGuard } from '../admin/roles.guard';
import { Roles } from '../admin/roles.decorator';
import {
  CurrentAdmin,
  CurrentAdminPayload,
} from '../admin/current-admin.decorator';
import { DecisionDto } from './dto/decision.dto';
import { BlockExpertDto } from './dto/block.dto';
import { QueueEntryDto } from './dto/queue.dto';
import { ExpertMeDto } from '../experts/dto/expert-me.dto';

@ApiTags('admin-verification')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
@Controller('admin')
export class VerificationController {
  constructor(private verificationService: VerificationService) {}

  @Get('verification/queue')
  @Roles(AdminRole.VERIFICATION_OPERATOR)
  @ApiOperation({ summary: 'Очередь экспертов на верификацию (PENDING)' })
  @ApiOkResponse({ type: QueueEntryDto, isArray: true })
  async queue(): Promise<QueueEntryDto[]> {
    return this.verificationService.queue();
  }

  @Post('verification/documents/:documentId/decision')
  @Roles(AdminRole.VERIFICATION_OPERATOR)
  @HttpCode(200)
  @ApiOperation({ summary: 'Решение по документу: approve/reject' })
  @ApiParam({ name: 'documentId', format: 'uuid' })
  @ApiOkResponse({ description: 'Решение зафиксировано' })
  @ApiBadRequestResponse({ description: 'VALIDATION_FAILED' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND' })
  async decideDocument(
    @Param('documentId') documentId: string,
    @Body() dto: DecisionDto,
    @CurrentAdmin() admin: CurrentAdminPayload,
  ) {
    return this.verificationService.decideDocument(documentId, dto, admin.id);
  }

  @Post('verification/:expertId/decision')
  @Roles(AdminRole.VERIFICATION_OPERATOR)
  @HttpCode(200)
  @ApiOperation({ summary: 'Решение по анкете эксперта: approve/reject' })
  @ApiParam({ name: 'expertId', format: 'uuid' })
  @ApiOkResponse({ description: 'Решение зафиксировано', type: ExpertMeDto })
  @ApiBadRequestResponse({
    description:
      'VALIDATION_FAILED | INVALID_STATE_TRANSITION | DOCUMENTS_INCOMPLETE',
  })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  async decideExpert(
    @Param('expertId') expertId: string,
    @Body() dto: DecisionDto,
    @CurrentAdmin() admin: CurrentAdminPayload,
  ): Promise<ExpertMeDto> {
    return this.verificationService.decideExpert(expertId, dto, admin.id);
  }

  @Post('experts/:expertId/block')
  @Roles(AdminRole.VERIFICATION_OPERATOR)
  @HttpCode(200)
  @ApiOperation({ summary: 'Заблокировать эксперта (Р-19)' })
  @ApiParam({ name: 'expertId', format: 'uuid' })
  @ApiOkResponse({ description: 'Эксперт заблокирован' })
  @ApiBadRequestResponse({ description: 'VALIDATION_FAILED' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  async block(
    @Param('expertId') expertId: string,
    @Body() dto: BlockExpertDto,
    @CurrentAdmin() admin: CurrentAdminPayload,
  ): Promise<Expert> {
    return this.verificationService.block(expertId, dto, admin.id);
  }

  @Post('experts/:expertId/unblock')
  @Roles(AdminRole.VERIFICATION_OPERATOR)
  @HttpCode(200)
  @ApiOperation({ summary: 'Снять блокировку эксперта' })
  @ApiParam({ name: 'expertId', format: 'uuid' })
  @ApiOkResponse({ description: 'Блокировка снята' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  async unblock(
    @Param('expertId') expertId: string,
    @CurrentAdmin() admin: CurrentAdminPayload,
  ): Promise<Expert> {
    return this.verificationService.unblock(expertId, admin.id);
  }
}
