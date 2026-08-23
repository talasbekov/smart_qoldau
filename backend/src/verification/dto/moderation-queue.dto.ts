import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

// Очередь модерации публичного профиля (E2a, задача 5).
export class ModerationQueueItemDto {
  @ApiProperty({ format: 'uuid' })
  expertId: string;

  @ApiProperty()
  displayName: string;

  @ApiPropertyOptional({ nullable: true, description: 'Фото, ждущее решения' })
  photoPendingUrl: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Текст, ждущий решения' })
  aboutPending: string | null;

  @ApiProperty({ description: 'Момент регистрации анкеты — по нему очередь' })
  submittedAt: Date;
}

export class ModerationQueueDto {
  @ApiProperty({ type: ModerationQueueItemDto, isArray: true })
  items: ModerationQueueItemDto[];

  @ApiProperty()
  total: number;
}

export class ModerationDecisionDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'])
  action: 'approve' | 'reject';

  // Причина обязательна при отклонении — специалист должен понимать, что
  // исправить. Проверка не декоратором, а в сервисе: она зависит от action.
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
