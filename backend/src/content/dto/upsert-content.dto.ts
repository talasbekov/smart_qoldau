import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentAccess, ContentKind } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/// Тело материала приходит как объект, а его форма зависит от вида.
/// Проверяется вручную в сервисе (`assertPayloadShape`), а не декораторами:
/// дискриминированный `@ValidateNested` на три разные формы в
/// class-validator читается хуже, чем пятнадцать строк явных проверок, и
/// ошибается там же.
export class UpsertContentDto {
  @ApiProperty({ enum: ContentKind })
  @IsEnum(ContentKind)
  kind!: ContentKind;

  @ApiPropertyOptional({ enum: ContentAccess })
  @IsOptional()
  @IsEnum(ContentAccess)
  access?: ContentAccess;

  @ApiProperty({ description: 'Латиница, цифры и дефис' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  @MinLength(3)
  @MaxLength(120)
  slug!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  category!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  titleRu!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  titleKk!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  summaryRu!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  summaryKk!: string;

  @ApiProperty({ description: 'Форма зависит от kind' })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24 * 60 * 60)
  durationSec?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  coverKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Публиковать сразу' })
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class PatchContentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @ApiPropertyOptional({ enum: ContentAccess })
  @IsOptional()
  @IsEnum(ContentAccess)
  access?: ContentAccess;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleRu?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titleKk?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summaryRu?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summaryKk?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
