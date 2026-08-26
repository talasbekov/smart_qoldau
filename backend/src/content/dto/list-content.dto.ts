import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContentKind } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListContentDto {
  @ApiPropertyOptional({ enum: ContentKind })
  @IsOptional()
  @IsEnum(ContentKind)
  kind?: ContentKind;

  @ApiPropertyOptional({ description: 'Категория-чипс: sleep | anxiety | ...' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;
}
