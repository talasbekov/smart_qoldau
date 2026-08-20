import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Админ-выдача FLAGGED-отзывов — видит ВСЁ, включая privateText и complaint.
export class FlaggedReviewDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  expertId: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @ApiPropertyOptional({ nullable: true })
  publicText: string | null;

  @ApiPropertyOptional({ nullable: true })
  privateText: string | null;

  @ApiPropertyOptional({ nullable: true })
  complaint: string | null;

  @ApiProperty()
  createdAt: Date;
}
