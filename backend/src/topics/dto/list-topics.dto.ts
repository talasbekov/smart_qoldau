import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

export class ListTopicsDto {
  @ApiPropertyOptional({ enum: ['ru', 'kz'], default: 'ru' })
  @IsOptional()
  @IsIn(['ru', 'kz'])
  locale?: 'ru' | 'kz';
}
