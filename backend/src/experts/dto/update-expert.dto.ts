import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsIn,
  IsInt,
  IsOptional,
  Length,
} from 'class-validator';
import { ExperienceLevel } from '@prisma/client';

const CITIES = ['Астана', 'Алматы', 'Шымкент'] as const;
const LANGUAGES = ['ru', 'kz', 'en'] as const;
const FORMATS = ['chat', 'audio', 'video'] as const;

// Разрешённые поля PATCH (Р-18): displayName, education, experience,
// priceTiyn, topicSlugs, formats, city, languages — все опциональны.
export class UpdateExpertDto {
  @ApiPropertyOptional({ example: 'Айгуль С.', minLength: 2, maxLength: 100 })
  @IsOptional()
  @Length(2, 100)
  displayName?: string;

  @ApiPropertyOptional({ enum: CITIES })
  @IsOptional()
  @IsIn(CITIES)
  city?: string;

  @ApiPropertyOptional({ enum: ExperienceLevel })
  @IsOptional()
  @IsIn(Object.values(ExperienceLevel))
  experience?: ExperienceLevel;

  @ApiPropertyOptional({
    example: 'КазНУ им. аль-Фараби',
    minLength: 2,
    maxLength: 500,
  })
  @IsOptional()
  @Length(2, 500)
  education?: string;

  @ApiPropertyOptional({ example: 449000, description: 'Цена в тиынах' })
  @IsOptional()
  @IsInt()
  priceTiyn?: number;

  @ApiPropertyOptional({ enum: LANGUAGES, isArray: true })
  @IsOptional()
  @ArrayNotEmpty()
  @IsIn(LANGUAGES, { each: true })
  languages?: string[];

  @ApiPropertyOptional({ enum: FORMATS, isArray: true })
  @IsOptional()
  @ArrayNotEmpty()
  @IsIn(FORMATS, { each: true })
  formats?: string[];

  @ApiPropertyOptional({ isArray: true, example: ['self-esteem'] })
  @IsOptional()
  @ArrayNotEmpty()
  topicSlugs?: string[];
}
