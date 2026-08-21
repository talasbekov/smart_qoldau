import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Пагинация GET /v1/admin/experts/flagged (Р-20, задача 9). Тот же
// паттерн, что и AdminListTicketsDto (задача 8): take default 20, max 100.
export class FlaggedExpertsQueryDto {
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;
}

// Строка очереди экспертов ниже порога рейтинга (Р-20: ratingCount >= 20 &&
// ratingAvg < 4.0) — команда качества раньше видела флаг только в
// audit_log (expert.rating_below_threshold, см. ReviewsService), эндпоинта
// на просмотр не было (E4).
export class FlaggedExpertDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  ratingAvg: number;

  @ApiProperty()
  ratingCount: number;
}
