import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { SESSION_FORMATS } from '../../common/constants/session-formats';

const LANGUAGES = ['ru', 'kz', 'en'] as const;
const SORTS = ['price_asc', 'price_desc', 'rating'] as const;

export class ListExpertsDto {
  @ApiPropertyOptional({ description: 'Slug темы из справочника /v1/topics' })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({ enum: LANGUAGES })
  @IsOptional()
  @IsIn(LANGUAGES)
  language?: string;

  @ApiPropertyOptional({ enum: SESSION_FORMATS })
  @IsOptional()
  @IsIn(SESSION_FORMATS)
  format?: string;

  @ApiPropertyOptional({ enum: SORTS })
  @IsOptional()
  @IsIn(SORTS)
  sort?: (typeof SORTS)[number];

  // Пагинация (E11a, задача 7): каталог рос без ограничения, и с
  // наполнением базы один запрос вытаскивал бы всех верифицированных
  // экспертов разом. Значения по умолчанию совместимы: вызов без
  // параметров отдаёт первую страницу в прежнем порядке.
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
