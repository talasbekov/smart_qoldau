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
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Expert } from '@prisma/client';
import { VerificationService } from './verification.service';
import { AdminTokenGuard } from './admin-token.guard';
import { DecisionDto } from './dto/decision.dto';
import { BlockExpertDto } from './dto/block.dto';
import { QueueEntryDto } from './dto/queue.dto';
import { ExpertMeDto } from '../experts/dto/expert-me.dto';

@ApiTags('admin-verification')
@ApiHeader({
  name: 'X-Admin-Token',
  description: 'Временный админ-токен до RBAC (эпик E8)',
  required: true,
})
@UseGuards(AdminTokenGuard)
@ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
@Controller('admin')
export class VerificationController {
  constructor(private verificationService: VerificationService) {}

  @Get('verification/queue')
  @ApiOperation({ summary: 'Очередь экспертов на верификацию (PENDING)' })
  @ApiOkResponse({ type: QueueEntryDto, isArray: true })
  async queue(): Promise<QueueEntryDto[]> {
    return this.verificationService.queue();
  }

  @Post('verification/documents/:documentId/decision')
  @HttpCode(200)
  @ApiOperation({ summary: 'Решение по документу: approve/reject' })
  @ApiParam({ name: 'documentId', format: 'uuid' })
  @ApiOkResponse({ description: 'Решение зафиксировано' })
  @ApiBadRequestResponse({ description: 'VALIDATION_FAILED' })
  @ApiNotFoundResponse({ description: 'NOT_FOUND' })
  async decideDocument(
    @Param('documentId') documentId: string,
    @Body() dto: DecisionDto,
  ) {
    return this.verificationService.decideDocument(documentId, dto);
  }

  @Post('verification/:expertId/decision')
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
  ): Promise<ExpertMeDto> {
    return this.verificationService.decideExpert(expertId, dto);
  }

  @Post('experts/:expertId/block')
  @HttpCode(200)
  @ApiOperation({ summary: 'Заблокировать эксперта (Р-19)' })
  @ApiParam({ name: 'expertId', format: 'uuid' })
  @ApiOkResponse({ description: 'Эксперт заблокирован' })
  @ApiBadRequestResponse({ description: 'VALIDATION_FAILED' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  async block(
    @Param('expertId') expertId: string,
    @Body() dto: BlockExpertDto,
  ): Promise<Expert> {
    return this.verificationService.block(expertId, dto);
  }

  @Post('experts/:expertId/unblock')
  @HttpCode(200)
  @ApiOperation({ summary: 'Снять блокировку эксперта' })
  @ApiParam({ name: 'expertId', format: 'uuid' })
  @ApiOkResponse({ description: 'Блокировка снята' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  async unblock(@Param('expertId') expertId: string): Promise<Expert> {
    return this.verificationService.unblock(expertId);
  }
}
