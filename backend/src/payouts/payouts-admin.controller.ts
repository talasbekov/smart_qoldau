import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminTokenGuard } from '../verification/admin-token.guard';
import { PayoutsService } from './payouts.service';
import { ListAdminPayoutsDto } from './dto/list-admin-payouts.dto';
import { AdminPayoutsListDto } from './dto/admin-payouts-list.dto';
import { RejectPayoutDto } from './dto/reject-payout.dto';

@ApiTags('admin-payouts')
@ApiHeader({
  name: 'X-Admin-Token',
  description: 'Временный админ-токен до RBAC (эпик E8)',
  required: true,
})
@UseGuards(AdminTokenGuard)
@ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
@Controller('admin/payouts')
export class PayoutsAdminController {
  constructor(private payouts: PayoutsService) {}

  @Get()
  @ApiOperation({
    summary: 'Очередь финконтроля выводов (по умолчанию PENDING_REVIEW, Р-06)',
  })
  @ApiOkResponse({ type: AdminPayoutsListDto })
  async list(
    @Query() query: ListAdminPayoutsDto,
  ): Promise<AdminPayoutsListDto> {
    return this.payouts.adminList(query.status, {
      take: query.take,
      skip: query.skip,
    });
  }

  @Post(':id/approve')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Одобрить вывод из очереди -> PROCESSING + отправка провайдеру',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNotFoundResponse({ description: 'PAYOUT_NOT_FOUND' })
  @ApiConflictResponse({ description: 'PAYOUT_NOT_PENDING' })
  async approve(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.payouts.approve(id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Отклонить вывод с причиной -> REJECTED + возврат резерва на баланс',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNotFoundResponse({ description: 'PAYOUT_NOT_FOUND' })
  @ApiConflictResponse({ description: 'PAYOUT_NOT_PENDING' })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPayoutDto,
  ): Promise<void> {
    await this.payouts.reject(id, dto.reason);
  }
}
