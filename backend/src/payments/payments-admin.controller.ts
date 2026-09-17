import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { AdminJwtGuard } from '../admin/admin-jwt.guard';
import { RolesGuard } from '../admin/roles.guard';
import { Roles } from '../admin/roles.decorator';
import { PaymentOperationalSignalDto } from './dto/payment-operational-signal.dto';
import { PaymentOperationalSignalService } from './payment-operational-signal.service';

@ApiTags('admin-payments')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, RolesGuard)
@ApiUnauthorizedResponse({ description: 'UNAUTHORIZED' })
@Controller('admin/payments')
export class PaymentsAdminController {
  constructor(private readonly signal: PaymentOperationalSignalService) {}

  @Get('operational-signal')
  @Roles(AdminRole.FINANCE_CONTROL)
  @ApiOperation({
    summary: 'Current local settle exhaustion; no provider outcome',
  })
  @ApiOkResponse({ type: PaymentOperationalSignalDto })
  operationalSignal(): Promise<PaymentOperationalSignalDto> {
    return this.signal.operationalSignal();
  }
}
