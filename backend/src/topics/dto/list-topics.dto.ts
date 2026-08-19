import { IsIn, IsOptional } from 'class-validator';

export class ListTopicsDto {
  @IsOptional()
  @IsIn(['ru', 'kz'])
  locale?: 'ru' | 'kz';
}
