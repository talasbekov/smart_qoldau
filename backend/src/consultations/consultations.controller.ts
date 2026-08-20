import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ConsultationsService } from './consultations.service';
import { ConsultationClientDto } from './dto/consultation-client.dto';
import { ConsultationExpertDto } from './dto/consultation-expert.dto';
import { ListConsultationsDto } from './dto/list-consultations.dto';
import { CompleteConsultationDto } from './dto/complete-consultation.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';

@ApiTags('consultations')
@ApiBearerAuth()
@Controller('consultations')
@UseGuards(JwtAuthGuard)
@ApiExtraModels(ConsultationClientDto, ConsultationExpertDto)
export class ConsultationsController {
  constructor(private consultations: ConsultationsService) {}

  @Get(':id')
  @ApiOperation({
    summary:
      'Консультация участника — клиент видит ConsultationClientDto, эксперт ConsultationExpertDto',
  })
  @ApiOkResponse({
    description: 'Консультация (форма зависит от роли вызывающего)',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(ConsultationClientDto) },
        { $ref: getSchemaPath(ConsultationExpertDto) },
      ],
    },
  })
  @ApiNotFoundResponse({ description: 'CONSULTATION_NOT_FOUND' })
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<ConsultationClientDto | ConsultationExpertDto> {
    return this.consultations.findForParticipant(id, user.sub);
  }

  @Get()
  @ApiOperation({
    summary:
      'Список своих консультаций (as=client|expert, default client), пагинация take/skip',
  })
  @ApiOkResponse({
    description: 'Список консультаций',
    schema: {
      type: 'array',
      items: {
        oneOf: [
          { $ref: getSchemaPath(ConsultationClientDto) },
          { $ref: getSchemaPath(ConsultationExpertDto) },
        ],
      },
    },
  })
  async list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListConsultationsDto,
  ): Promise<(ConsultationClientDto | ConsultationExpertDto)[]> {
    return this.consultations.listForUser(user.sub, query);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Завершение консультации экспертом с исходом (COMPLETED|CLIENT_NO_SHOW|CLIENT_CANCELLED|TECH_ISSUE)',
  })
  @ApiOkResponse({ type: ConsultationExpertDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — не эксперт-участник' })
  @ApiNotFoundResponse({ description: 'CONSULTATION_NOT_FOUND' })
  @ApiConflictResponse({ description: 'CONSULTATION_NOT_ACTIVE' })
  async complete(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CompleteConsultationDto,
  ): Promise<ConsultationExpertDto> {
    return this.consultations.complete(id, user.sub, dto.outcome);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Отмена консультации клиентом' })
  @ApiOkResponse({ type: ConsultationClientDto })
  @ApiForbiddenResponse({ description: 'FORBIDDEN — не клиент-участник' })
  @ApiNotFoundResponse({ description: 'CONSULTATION_NOT_FOUND' })
  @ApiConflictResponse({ description: 'CONSULTATION_NOT_ACTIVE' })
  async cancel(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<ConsultationClientDto> {
    return this.consultations.cancel(id, user.sub);
  }
}
