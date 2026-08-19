import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class ConvertGuestDto {
  @ApiProperty({
    example: '+77011234567',
    description: 'Казахстанский мобильный номер в формате +77XXXXXXXXX',
    pattern: '^\\+77\\d{9}$',
  })
  @Matches(/^\+77\d{9}$/)
  phone: string;

  @ApiProperty({
    example: '1234',
    description: 'Одноразовый SMS-код (4 цифры)',
  })
  @IsString()
  @Length(4, 4)
  code: string;
}
