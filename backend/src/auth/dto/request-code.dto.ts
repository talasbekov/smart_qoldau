import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class RequestCodeDto {
  @ApiProperty({
    example: '+77011234567',
    description: 'Казахстанский мобильный номер в формате +77XXXXXXXXX',
    pattern: '^\\+77\\d{9}$',
  })
  @Matches(/^\+77\d{9}$/)
  phone: string;
}
