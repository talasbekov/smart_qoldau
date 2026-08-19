import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

const FORMATS = ['chat', 'audio', 'video'] as const;

export class CreateRequestDto {
  @ApiProperty({
    example: 'anxiety-stress',
    description: 'Slug темы из справочника /v1/topics',
  })
  @IsString()
  topicSlug: string;

  @ApiProperty({ enum: FORMATS })
  @IsIn(FORMATS)
  format: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Экстренная заявка — дедлайн оффера 20с, только acceptsUrgent',
  })
  @IsOptional()
  @IsBoolean()
  isEmergency?: boolean;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Ручной выбор эксперта из каталога (directed-заявка)',
  })
  @IsOptional()
  @IsUUID()
  expertId?: string;
}
