import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Expert } from '@prisma/client';
import { ScheduleExceptionsService } from './schedule-exceptions.service';
import {
  ListScheduleExceptionsDto,
  ScheduleExceptionDto,
  UpsertScheduleExceptionDto,
} from './dto/schedule-exception.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExpertGuard } from '../experts/expert.guard';
import { CurrentExpert } from '../experts/current-expert.decorator';

@ApiTags('experts')
@Controller('experts/me/schedule/exceptions')
@UseGuards(JwtAuthGuard, ExpertGuard)
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
@ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
export class ScheduleExceptionsController {
  constructor(private exceptions: ScheduleExceptionsService) {}

  @Get()
  @ApiOperation({ summary: 'Исключения расписания за период' })
  @ApiOkResponse({ type: ScheduleExceptionDto, isArray: true })
  list(
    @CurrentExpert() expert: Expert,
    @Query() query: ListScheduleExceptionsDto,
  ): Promise<ScheduleExceptionDto[]> {
    return this.exceptions.list(expert.id, query);
  }

  @Put(':date')
  @ApiOperation({ summary: 'Задать выходной или иные часы на дату' })
  @ApiParam({ name: 'date', example: '2026-08-26' })
  @ApiOkResponse({ type: ScheduleExceptionDto })
  @ApiBadRequestResponse({
    description: 'SCHEDULE_EXCEPTION_INVALID | SCHEDULE_EXCEPTION_PAST',
  })
  upsert(
    @CurrentExpert() expert: Expert,
    @Param('date') date: string,
    @Body() dto: UpsertScheduleExceptionDto,
  ): Promise<ScheduleExceptionDto> {
    return this.exceptions.upsert(expert, date, dto);
  }

  @Delete(':date')
  @HttpCode(204)
  @ApiOperation({ summary: 'Снять исключение (идемпотентно)' })
  @ApiParam({ name: 'date', example: '2026-08-26' })
  @ApiNoContentResponse({ description: 'Исключение снято' })
  remove(
    @CurrentExpert() expert: Expert,
    @Param('date') date: string,
  ): Promise<void> {
    return this.exceptions.remove(expert, date);
  }
}
