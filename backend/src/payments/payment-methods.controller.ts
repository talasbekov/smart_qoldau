import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { PaymentMethodsService } from './payment-methods.service';
import { AddPaymentMethodDto } from './dto/add-payment-method.dto';
import { PaymentMethodDto } from './dto/payment-method.dto';

// Доступно любому авторизованному пользователю, включая гостя (оплата до
// конверсии в клиента) — эксперт-only токен без клиентской роли не
// требуется, ограничений по ролям здесь нет.
@ApiTags('payment-methods')
@ApiBearerAuth()
@Controller('payment-methods')
@UseGuards(JwtAuthGuard)
export class PaymentMethodsController {
  constructor(private paymentMethods: PaymentMethodsService) {}

  @Post()
  @ApiCreatedResponse({
    type: PaymentMethodDto,
    description: 'Карта привязана',
  })
  async add(
    @Body() dto: AddPaymentMethodDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PaymentMethodDto> {
    return this.paymentMethods.add(user.sub, dto);
  }

  @Get()
  @ApiOkResponse({ type: [PaymentMethodDto], description: 'Свои живые карты' })
  async list(@CurrentUser() user: JwtPayload): Promise<PaymentMethodDto[]> {
    return this.paymentMethods.list(user.sub);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Карта откреплена (soft-delete)' })
  @ApiNotFoundResponse({ description: 'PAYMENT_METHOD_NOT_FOUND' })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.paymentMethods.remove(user.sub, id);
  }
}
