import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionPlan } from '@prisma/client';

export class PremiumPlanDto {
  @ApiProperty({ enum: SubscriptionPlan })
  plan: SubscriptionPlan;

  @ApiProperty({ description: 'Цена тарифа в тиынах' })
  priceTiyn: number;

  @ApiProperty({ description: 'Длина оплаченного периода в днях' })
  periodDays: number;
}

export class PremiumPlansDto {
  @ApiProperty({ type: [PremiumPlanDto] })
  plans: PremiumPlanDto[];

  @ApiProperty({ description: 'Скидка Premium на консультацию, в процентах' })
  discountPercent: number;
}
