import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketCategory } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({
    enum: TicketCategory,
    description:
      'Набор допустимых категорий зависит от типа автора (клиент/гость vs эксперт) — см. CATEGORIES_BY_AUTHOR',
  })
  @IsEnum(TicketCategory)
  category: TicketCategory;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  body: string;

  @ApiPropertyOptional({
    description:
      'Обязателен для гостя (без токена), если не передан contactPhone. У авторизованного автора игнорируется — контакт берётся из аккаунта.',
  })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional({
    example: '+77011234567',
    pattern: '^\\+77\\d{9}$',
    description:
      'Обязателен для гостя (без токена), если не передан contactEmail. У авторизованного автора игнорируется — контакт берётся из аккаунта.',
  })
  @IsOptional()
  @Matches(/^\+77\d{9}$/)
  contactPhone?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  relatedConsultationId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  relatedPayoutId?: string;
}
