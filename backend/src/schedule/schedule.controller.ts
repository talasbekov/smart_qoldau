import { Body, Controller, Get, Patch, Put, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Expert } from '@prisma/client';
import { ScheduleService } from './schedule.service';
import { ScheduleResponseDto, UpdateScheduleDto } from './dto/schedule-day.dto';
import { UpdateAvailabilityDto } from './dto/availability.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExpertGuard } from '../experts/expert.guard';
import { CurrentExpert } from '../experts/current-expert.decorator';
import { ExpertsService } from '../experts/experts.service';

@ApiTags('experts')
@Controller('experts/me')
@UseGuards(JwtAuthGuard, ExpertGuard)
@ApiBearerAuth()
export class ScheduleController {
  constructor(
    private scheduleService: ScheduleService,
    private expertsService: ExpertsService,
  ) {}

  @Get('schedule')
  @ApiOperation({ summary: 'Получить расписание эксперта (7 дней)' })
  @ApiOkResponse({ description: 'Расписание', type: ScheduleResponseDto })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  async getSchedule(
    @CurrentExpert() expert: Expert,
  ): Promise<ScheduleResponseDto> {
    const days = await this.scheduleService.getSchedule(expert.id);
    return { days };
  }

  @Put('schedule')
  @ApiOperation({ summary: 'Задать расписание эксперта (полная замена)' })
  @ApiOkResponse({
    description: 'Расписание сохранено',
    type: ScheduleResponseDto,
  })
  @ApiBadRequestResponse({ description: 'SCHEDULE_INVALID' })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  async putSchedule(
    @CurrentExpert() expert: Expert,
    @Body() dto: UpdateScheduleDto,
  ): Promise<ScheduleResponseDto> {
    const days = await this.scheduleService.updateSchedule(expert, dto);
    return { days };
  }

  @Patch('availability')
  @ApiOperation({ summary: 'Переключить готовность принимать срочные заявки' })
  @ApiOkResponse({ description: 'Готовность обновлена' })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  async updateAvailability(
    @CurrentExpert() expert: Expert,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    const updated = await this.scheduleService.updateAvailability(expert, dto);
    const withTopics = await this.expertsService.findByUserId(updated.userId);
    return this.expertsService.toMeDto(withTopics!);
  }
}
