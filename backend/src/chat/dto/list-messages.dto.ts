import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListMessagesDto {
  // cursor — id последнего сообщения предыдущей страницы (не сам createdAt,
  // см. ChatService.listHistory: фильтр по (createdAt, id) этого сообщения).
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
