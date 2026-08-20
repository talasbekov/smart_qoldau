import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Expert } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExpertGuard } from '../experts/expert.guard';
import { CurrentExpert } from '../experts/current-expert.decorator';
import { PaymentsService } from './payments.service';
import { EarningsDto } from './dto/earnings.dto';
import { ListEarningsDto } from './dto/list-earnings.dto';

// Живёт в PaymentsModule (не ExpertsModule) — бизнес-домен начислений
// принадлежит платёжному контуру, аналогично PaymentsController рядом с
// ConsultationsController (см. комментарий там).
@ApiTags('payments')
@ApiBearerAuth()
@Controller('experts/me/earnings')
@UseGuards(JwtAuthGuard, ExpertGuard)
export class EarningsController {
  constructor(private payments: PaymentsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Начисления эксперта (Р-02) — список capture-платежей + текущий баланс',
  })
  @ApiOkResponse({ type: EarningsDto })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  async list(
    @CurrentExpert() expert: Expert,
    @Query() query: ListEarningsDto,
  ): Promise<EarningsDto> {
    return this.payments.getEarnings(expert.id, query);
  }
}
