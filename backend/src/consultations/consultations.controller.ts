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
  ApiBadRequestResponse,
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
import { BookingService } from '../booking/booking.service';
import { BookingResultDto } from '../booking/dto/create-booking.dto';
import { RescheduleDto } from '../booking/dto/reschedule.dto';

@ApiTags('consultations')
@ApiBearerAuth()
@Controller('consultations')
@UseGuards(JwtAuthGuard)
@ApiExtraModels(ConsultationClientDto, ConsultationExpertDto)
export class ConsultationsController {
  constructor(
    private consultations: ConsultationsService,
    private booking: BookingService,
  ) {}

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

  @Post(':id/reschedule')
  @HttpCode(200)
  @ApiOperation({ summary: 'Перенести плановую консультацию на другой слот' })
  @ApiOkResponse({ description: 'Время изменено', type: BookingResultDto })
  @ApiBadRequestResponse({ description: 'SLOT_OUT_OF_RANGE' })
  @ApiNotFoundResponse({ description: 'CONSULTATION_NOT_FOUND' })
  @ApiConflictResponse({
    description: 'CONSULTATION_NOT_SCHEDULED | SLOT_TAKEN | SLOT_UNAVAILABLE',
  })
  reschedule(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RescheduleDto,
  ): Promise<BookingResultDto> {
    return this.booking.reschedule(id, user.sub, dto.slotStartAt);
  }

  @Post(':id/cancel-by-expert')
  @HttpCode(200)
  @ApiOperation({ summary: 'Отмена плановой консультации специалистом' })
  @ApiOkResponse({ description: 'Консультация отменена' })
  @ApiNotFoundResponse({ description: 'CONSULTATION_NOT_FOUND' })
  @ApiConflictResponse({ description: 'CONSULTATION_NOT_SCHEDULED' })
  cancelByExpert(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.booking.cancelByExpert(id, user.sub);
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
