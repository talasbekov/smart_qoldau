import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsIn, IsInt, Length } from 'class-validator';
import { ExperienceLevel } from '@prisma/client';
import { SESSION_FORMATS } from '../../common/constants/session-formats';

const CITIES = ['Астана', 'Алматы', 'Шымкент'] as const;
const LANGUAGES = ['ru', 'kz', 'en'] as const;

export class CreateExpertDto {
  @ApiProperty({ example: 'Айгуль С.', minLength: 2, maxLength: 100 })
  @Length(2, 100)
  displayName: string;

  @ApiProperty({ enum: CITIES })
  @IsIn(CITIES)
  city: string;

  @ApiProperty({ enum: ExperienceLevel })
  @IsIn(Object.values(ExperienceLevel))
  experience: ExperienceLevel;

  @ApiProperty({
    example: 'КазНУ им. аль-Фараби',
    minLength: 2,
    maxLength: 500,
  })
  @Length(2, 500)
  education: string;

  // Коридор цены (200000-1500000 тиын) проверяет сервис через apiError
  // с кодом PRICE_OUT_OF_RANGE — здесь только базовая валидация типа.
  @ApiProperty({ example: 399000, description: 'Цена в тиынах' })
  @IsInt()
  priceTiyn: number;

  @ApiProperty({ enum: LANGUAGES, isArray: true, example: ['ru', 'kz'] })
  @ArrayNotEmpty()
  @IsIn(LANGUAGES, { each: true })
  languages: string[];

  @ApiProperty({
    enum: SESSION_FORMATS,
    isArray: true,
    example: ['chat', 'audio', 'video'],
  })
  @ArrayNotEmpty()
  @IsIn(SESSION_FORMATS, { each: true })
  formats: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['anxiety-stress', 'burnout'],
    description: 'Slug-и тем из справочника /v1/topics',
  })
  @ArrayNotEmpty()
  topicSlugs: string[];
}
