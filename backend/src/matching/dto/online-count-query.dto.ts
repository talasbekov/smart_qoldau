import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

const FORMATS = ['chat', 'audio', 'video'] as const;

// Валидация topicSlug/format зеркалит CreateRequestDto (E1/E3) —
// счётчик отвечает на тот же вопрос ("кто подходит клиенту сейчас"),
// что и создание заявки, поэтому набор допустимых форматов общий.
export class OnlineCountQueryDto {
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
    description:
      'Только эксперты с acceptsUrgent=true (экстренный поиск, БП-02)',
  })
  @IsOptional()
  // Query-параметры всегда строки; ValidationPipe в этом проекте работает
  // без transform:true (см. bootstrap.ts), поэтому "true"/"false" из строки
  // запроса нужно привести к boolean явно, иначе @IsBoolean() отклонит
  // валидный ?urgentOnly=true как невалидный.
  @Transform(({ value }) =>
    value === undefined ? undefined : value === true || value === 'true',
  )
  @IsBoolean()
  urgentOnly?: boolean;
}
