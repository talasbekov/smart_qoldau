import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// То же самое, что ReviewItemDto, но для GET /experts/me/reviews
// (аутентифицированный эксперт смотрит СВОИ отзывы) — с id: он нужен для
// POST /reviews/{id}/reply|complaint, которые ReviewItemDto намеренно не
// отдаёт (публичная анонимная выдача).
export class OwnReviewItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @ApiPropertyOptional({ nullable: true })
  publicText: string | null;

  @ApiPropertyOptional({ nullable: true })
  expertReply: string | null;

  @ApiProperty({ isArray: true, example: ['attentive'] })
  tags: string[];

  @ApiProperty()
  createdAt: Date;
}
