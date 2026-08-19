import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const LANGUAGES = ['ru', 'kz', 'en'] as const;
const FORMATS = ['chat', 'audio', 'video'] as const;
const SORTS = ['price_asc', 'price_desc'] as const;

export class ListExpertsDto {
  @ApiPropertyOptional({ description: 'Slug темы из справочника /v1/topics' })
  @IsOptional()
  @IsString()
  topic?: string;

  @ApiPropertyOptional({ enum: LANGUAGES })
  @IsOptional()
  @IsIn(LANGUAGES)
  language?: string;

  @ApiPropertyOptional({ enum: FORMATS })
  @IsOptional()
  @IsIn(FORMATS)
  format?: string;

  @ApiPropertyOptional({ enum: SORTS })
  @IsOptional()
  @IsIn(SORTS)
  sort?: (typeof SORTS)[number];
}
