import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserThrottlerGuard } from '../common/throttle/throttle.guards';
import { THROTTLE } from '../common/throttle/throttle.constants';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { PaymentsService } from './payments.service';
import { PayConsultationDto } from './dto/pay-consultation.dto';
import { PayResultDto } from './dto/pay-result.dto';
import { PaymentStatusDto } from './dto/payment-status.dto';

// Роуты вложены в /v1/consultations/:id/... (см. бриф Task 4), но
// реализация живёт в PaymentsModule — держим маршрутизацию бизнес-домена
// платежей отдельно от ConsultationsController, аналогично NotesController.
@ApiTags('payments')
@ApiBearerAuth()
@Controller('consultations/:id')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  // Оплата идёт к эквайеру с картой, которую выбрал пользователь: без
  // лимита эндпоинт становится площадкой для перебора краденых карт (см.
  // THROTTLE.paymentAttempt). Порядок guard'ов важен: сначала JWT, иначе
  // троттлер считает всех за одним NAT как одного.
  @Post('pay')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: THROTTLE.paymentAttempt })
  @HttpCode(200)
  @ApiOperation({
    summary: 'Оплата консультации (холд) — только клиент-участник',
  })
  @ApiOkResponse({ type: PayResultDto })
  @ApiNotFoundResponse({
    description: 'CONSULTATION_NOT_FOUND | PAYMENT_METHOD_NOT_FOUND',
  })
  @ApiConflictResponse({
    description: 'CONSULTATION_NOT_ACTIVE | ALREADY_PAID',
  })
  async pay(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: PayConsultationDto,
  ): Promise<PayResultDto> {
    return this.payments.pay(id, user.sub, dto.paymentMethodId);
  }

  @Get('payment')
  @ApiOperation({
    summary: 'Статус платежа консультации — только клиент-участник',
  })
  @ApiOkResponse({ type: PaymentStatusDto })
  @ApiNotFoundResponse({ description: 'CONSULTATION_NOT_FOUND' })
  async getStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<PaymentStatusDto> {
    return this.payments.getStatus(id, user.sub);
  }
}
