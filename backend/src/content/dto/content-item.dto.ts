import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContentAccess, ContentKind } from '@prisma/client';

/// Тело материала на языке пользователя. Форма зависит от вида: у статьи —
/// markdown, у дыхательной техники — фазы, у аудио тела нет вовсе (ссылка
/// выдаётся отдельным запросом, чтобы пейволл стоял до неё).
export class ContentBodyDto {
  @ApiPropertyOptional({ description: 'ARTICLE: текст на языке пользователя' })
  markdown?: string;

  @ApiPropertyOptional({ description: 'BREATHING: фазы цикла' })
  phases?: { name: string; seconds: number }[];

  @ApiPropertyOptional({ description: 'BREATHING: сколько циклов' })
  cycles?: number;
}

export class ContentItemDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: ContentKind }) kind!: ContentKind;
  @ApiProperty({ enum: ContentAccess }) access!: ContentAccess;
  @ApiProperty() slug!: string;
  @ApiProperty() category!: string;
  @ApiProperty({ description: 'Заголовок на языке пользователя' })
  title!: string;
  @ApiProperty({ description: 'Краткое описание на языке пользователя' })
  summary!: string;
  @ApiPropertyOptional({ nullable: true }) durationSec?: number | null;
  @ApiPropertyOptional({ nullable: true }) coverUrl?: string | null;

  @ApiProperty({
    description:
      'Материал за подпиской, а подписки нет. Карточку всё равно показываем: ' +
      'человек должен понимать, что именно за пейволлом. Решение о доступе ' +
      'принимает сервер при выдаче ссылки, а не приложение по этому флагу.',
  })
  locked!: boolean;

  @ApiPropertyOptional({ description: 'Прогресс 0–1000, если он есть' })
  positionPermille?: number;

  @ApiPropertyOptional({ type: ContentBodyDto })
  body?: ContentBodyDto;

  @ApiPropertyOptional({
    description: 'Сколько человек сочли материал полезным',
  })
  usefulYes?: number;

  @ApiPropertyOptional() usefulNo?: number;
}
