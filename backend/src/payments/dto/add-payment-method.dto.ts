import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class AddPaymentMethodDto {
  @ApiProperty({ example: '4111111111111111', description: 'PAN карты' })
  @IsString()
  @Matches(/^\d{12,19}$/, { message: 'PAN должен содержать 12-19 цифр' })
  pan: string;

  @ApiProperty({ example: '12/28', description: 'MM/YY' })
  @IsString()
  @Matches(/^(0[1-9]|1[0-2])\/\d{2}$/, {
    message: 'expiry должен быть в формате MM/YY',
  })
  expiry: string;

  @ApiProperty({ example: 'Ivan Petrov' })
  @IsString()
  @Length(2, 100)
  holderName: string;
}
