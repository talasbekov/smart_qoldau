import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class UpdateLocaleDto {
  @ApiProperty({ enum: ['ru', 'kz'] })
  @IsIn(['ru', 'kz'])
  locale: string;
}
