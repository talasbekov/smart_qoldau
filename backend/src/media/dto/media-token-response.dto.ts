import { ApiProperty } from '@nestjs/swagger';

export class MediaTokenResponseDto {
  @ApiProperty({ description: 'LiveKit access JWT (TTL 2ч)' })
  token: string;

  @ApiProperty({ description: 'LiveKit server URL (LIVEKIT_URL)' })
  url: string;

  @ApiProperty({ description: 'Комната LiveKit, cons-{consultationId}' })
  room: string;
}
