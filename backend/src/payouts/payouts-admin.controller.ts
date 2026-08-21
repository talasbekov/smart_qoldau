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
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../admin/admin-jwt.guard';
import { RolesGuard } from '../admin/roles.guard';
import { Roles } from '../admin/roles.decorator';
import {
  CurrentAdmin,
  CurrentAdminPayload,
} from '../admin/current-admin.decorator';
import { PayoutsService } from './payouts.service';
import { ListAdminPayoutsDto } from './dto/list-admin-payouts.dto';
import { AdminPayoutsListDto } from './dto/admin-payouts-list.dto';
import { RejectPayoutDto } from './dto/reject-payout.dto';

@ApiTags('admin-payouts')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
@Controller('admin/payouts')
export class PayoutsAdminController {
  constructor(private payouts: PayoutsService) {}

  @Get()
  @Roles(AdminRole.FINANCE_CONTROL)
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
  @Roles(AdminRole.FINANCE_CONTROL)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Одобрить вывод из очереди -> PROCESSING + отправка провайдеру',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNotFoundResponse({ description: 'PAYOUT_NOT_FOUND' })
  @ApiConflictResponse({ description: 'PAYOUT_NOT_PENDING' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAdmin() admin: CurrentAdminPayload,
  ): Promise<void> {
    await this.payouts.approve(id, admin.id);
  }

  @Post(':id/reject')
  @Roles(AdminRole.FINANCE_CONTROL)
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
    @CurrentAdmin() admin: CurrentAdminPayload,
  ): Promise<void> {
    await this.payouts.reject(id, dto.reason, admin.id);
  }
}
