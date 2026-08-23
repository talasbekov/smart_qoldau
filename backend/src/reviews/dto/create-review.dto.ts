import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  publicText?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  privateText?: string;

  // Закрытый словарь по оценке (E2a): свободный ввод не принимается —
  // это был бы второй канал публичного текста в обход модерации. Сама
  // принадлежность набору проверяется в сервисе: она зависит от rating.
  @ApiPropertyOptional({
    isArray: true,
    maxItems: 3,
    example: ['attentive', 'helped_figure_out'],
    description: 'Коды тегов из набора выставленной оценки',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsString({ each: true })
  tags?: string[];
}
