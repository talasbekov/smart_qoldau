import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Expert } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExpertGuard } from '../experts/expert.guard';
import { CurrentExpert } from '../experts/current-expert.decorator';
import { PayoutsService } from './payouts.service';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { PayoutDto } from './dto/payout.dto';
import { PayoutsListDto } from './dto/payouts-list.dto';
import { BalanceDto } from './dto/balance.dto';
import { ListPayoutsDto } from './dto/list-payouts.dto';

// Без префикса контроллера: /v1/experts/me/balance живёт рядом с
// /v1/payouts — оба принадлежат домену выводов (баланс = то, что доступно
// к выводу), пути задаются на методах.
@ApiTags('payouts')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, ExpertGuard)
export class PayoutsController {
  constructor(private payouts: PayoutsService) {}

  @Get('experts/me/balance')
  @ApiOperation({ summary: 'Баланс эксперта (доступно к выводу, Р-06)' })
  @ApiOkResponse({ type: BalanceDto })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  async balance(@CurrentExpert() expert: Expert): Promise<BalanceDto> {
    return this.payouts.getBalance(expert.id);
  }

  @Post('payouts')
  @ApiOperation({
    summary:
      'Заявка на вывод — минимум 10 000 ₸, автоодобрение до 300 000 ₸/мес (Р-06)',
  })
  @ApiCreatedResponse({ type: PayoutDto })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  async request(
    @CurrentExpert() expert: Expert,
    @Body() dto: RequestPayoutDto,
  ): Promise<PayoutDto> {
    return this.payouts.request(expert, dto);
  }

  @Get('payouts')
  @ApiOperation({ summary: 'Свои выводы (новые сверху)' })
  @ApiOkResponse({ type: PayoutsListDto })
  @ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
  async list(
    @CurrentExpert() expert: Expert,
    @Query() query: ListPayoutsDto,
  ): Promise<PayoutsListDto> {
    return this.payouts.list(expert.id, query);
  }
}
