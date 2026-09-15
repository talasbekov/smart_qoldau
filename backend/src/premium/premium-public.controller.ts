import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SubscriptionPlan } from '@prisma/client';
import { PremiumPlansDto } from './dto/premium-plans.dto';
import {
  PERIOD_DAYS,
  PREMIUM_DISCOUNT_BP,
  PREMIUM_PRICES,
} from './premium.constants';

// Отдельный контроллер БЕЗ guard'а — тот же приём, что у
// ExpertsPublicController. Витрина тарифов на лендинге показывается
// анониму: человек решает, стоит ли регистрироваться, до входа.
//
// Цены отдаются API, а не зашиваются в каждый клиент. До этого они были
// продублированы в бэкенде, в двух экранах приложения клиента, в тестах
// веба и в файлах перевода — правка цены означала правку в пяти местах,
// и любое из них могло отстать.
@ApiTags('premium')
@Controller('premium')
export class PremiumPublicController {
  @Get('plans')
  @ApiOperation({ summary: 'Тарифы Premium и цены (публично)' })
  @ApiOkResponse({ type: PremiumPlansDto })
  plans(): PremiumPlansDto {
    return {
      plans: (Object.keys(PREMIUM_PRICES) as SubscriptionPlan[]).map(
        (plan) => ({
          plan,
          priceTiyn: PREMIUM_PRICES[plan],
          periodDays: PERIOD_DAYS[plan],
        }),
      ),
      discountPercent: PREMIUM_DISCOUNT_BP / 100,
    };
  }
}
