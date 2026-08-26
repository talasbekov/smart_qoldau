import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { PremiumService } from './premium.service';
import { SubscribeDto } from './dto/subscribe.dto';
import { PremiumStatusDto } from './dto/premium-status.dto';

@ApiTags('premium')
@ApiBearerAuth()
@Controller('premium')
@UseGuards(JwtAuthGuard)
export class PremiumController {
  constructor(private premium: PremiumService) {}

  @Get()
  @ApiOkResponse({ type: PremiumStatusDto, description: 'Статус подписки' })
  async status(@CurrentUser() user: JwtPayload): Promise<PremiumStatusDto> {
    return this.premium.status(user.sub);
  }

  @Post('subscribe')
  @ApiCreatedResponse({
    type: PremiumStatusDto,
    description: 'Подписка оформлена',
  })
  @ApiConflictResponse({ description: 'Подписка уже оформлена' })
  @ApiNotFoundResponse({ description: 'Карта не найдена' })
  async subscribe(
    @Body() dto: SubscribeDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PremiumStatusDto> {
    return this.premium.subscribe(user.sub, dto.plan, dto.paymentMethodId);
  }

  @Post('cancel')
  @HttpCode(200)
  @ApiOkResponse({ type: PremiumStatusDto, description: 'Подписка отменена' })
  @ApiNotFoundResponse({ description: 'Активной подписки нет' })
  async cancel(@CurrentUser() user: JwtPayload): Promise<PremiumStatusDto> {
    return this.premium.cancel(user.sub);
  }
}
