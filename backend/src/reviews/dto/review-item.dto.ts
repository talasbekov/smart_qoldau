import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Публичная строка отзыва. ПОЛНАЯ анонимность автора — никаких id/кодов
// клиента. privateText НИКОГДА не попадает в этот DTO.
export class ReviewItemDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @ApiPropertyOptional({ nullable: true })
  publicText: string | null;

  @ApiPropertyOptional({ nullable: true })
  expertReply: string | null;

  @ApiProperty()
  createdAt: Date;
}
