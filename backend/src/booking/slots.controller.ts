import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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
import { VerificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../common/clock/clock.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { apiError } from '../common/filters/app-exception.filter';
import { SlotsService } from './slots.service';
import { ListSlotsDto, SlotsResponseDto } from './dto/slot.dto';
import { HORIZON_DAYS } from './booking.constants';

const MS_PER_DAY = 24 * 60 * 60_000;

@ApiTags('booking')
@Controller('experts/:id/slots')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SlotsController {
  constructor(
    private slots: SlotsService,
    private prisma: PrismaService,
    private clock: ClockService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Свободные слоты специалиста (горизонт 14 дней)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: SlotsResponseDto })
  @ApiBadRequestResponse({ description: 'SLOTS_RANGE_TOO_WIDE' })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  @ApiNotFoundResponse({ description: 'EXPERT_NOT_FOUND' })
  async list(
    @Param('id') expertId: string,
    @Query() query: ListSlotsDto,
  ): Promise<SlotsResponseDto> {
    const expert = await this.prisma.expert.findUnique({
      where: { id: expertId },
    });
    // Заблокированный или непроверенный специалист не должен отличаться от
    // несуществующего: иначе перебором можно узнать, кого заблокировали.
    if (
      !expert ||
      expert.isBlocked ||
      expert.verificationStatus !== VerificationStatus.VERIFIED
    ) {
      apiError('EXPERT_NOT_FOUND', 'Эксперт не найден', 404);
    }

    const now = this.clock.now();
    const requestedFrom = query.from ? new Date(query.from) : now;
    // Прошлое подтягивается к «сейчас», а не отвергается: клиент мог
    // открыть экран вчера и вернуться к нему сегодня.
    const from = requestedFrom.getTime() < now.getTime() ? now : requestedFrom;
    const to = query.to
      ? new Date(query.to)
      : new Date(from.getTime() + HORIZON_DAYS * MS_PER_DAY);

    if (to.getTime() - from.getTime() > HORIZON_DAYS * MS_PER_DAY) {
      apiError(
        'SLOTS_RANGE_TOO_WIDE',
        `Диапазон не может превышать ${HORIZON_DAYS} дней`,
        400,
      );
    }

    const items = await this.slots.freeSlots(expertId, from, to);
    return {
      items: items.map((startAt) => ({ startAt: startAt.toISOString() })),
    };
  }
}
