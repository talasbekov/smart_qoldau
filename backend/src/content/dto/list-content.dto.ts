import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContentKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ListContentDto {
  @ApiPropertyOptional({
    enum: ['ru', 'kk'],
    description: 'Язык для анонимного читателя: у него нет профиля с локалью',
  })
  @IsOptional()
  @IsIn(['ru', 'kk'])
  locale?: string;

  @ApiPropertyOptional({ enum: ContentKind })
  @IsOptional()
  @IsEnum(ContentKind)
  kind?: ContentKind;

  @ApiPropertyOptional({ description: 'Категория-чипс: sleep | anxiety | ...' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  // Пагинация с самого начала, а не «когда библиотека вырастет»: ровно этот
  // долг пришлось закрывать в каталоге экспертов (E11a, задача 7), когда
  // один запрос начал вытаскивать всех разом.
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
