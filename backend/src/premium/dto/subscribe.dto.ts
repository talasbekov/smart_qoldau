import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class SubscribeDto {
  @ApiProperty({ enum: ['MONTH', 'YEAR'], description: 'Тариф Premium' })
  @IsIn(['MONTH', 'YEAR'])
  plan!: 'MONTH' | 'YEAR';

  @ApiProperty({ description: 'Привязанная карта, с которой списать' })
  @IsString()
  paymentMethodId!: string;
}
