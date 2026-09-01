import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class VerifyCodeDto {
  @ApiProperty({
    example: '+77011234567',
    description: 'Казахстанский мобильный номер в формате +77XXXXXXXXX',
    pattern: '^\\+77\\d{9}$',
  })
  @Matches(/^\+77\d{9}$/)
  phone: string;

  @ApiProperty({
    example: '123456',
    description: 'Одноразовый SMS-код (6 цифр)',
  })
  @IsString()
  @Length(6, 6)
  code: string;
}
