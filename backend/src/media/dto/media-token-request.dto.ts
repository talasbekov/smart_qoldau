import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const MEDIA_FORMATS = ['audio', 'video'] as const;
export type MediaFormat = (typeof MEDIA_FORMATS)[number];

// Запрашиваемый формат медиа-сессии — chat не запрашивается (chat не требует
// LiveKit-токена, это только эскалация ИЗ chat в audio/video).
export class MediaTokenRequestDto {
  @ApiProperty({ enum: MEDIA_FORMATS })
  @IsIn(MEDIA_FORMATS)
  format: MediaFormat;
}
