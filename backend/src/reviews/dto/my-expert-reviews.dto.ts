import { ApiProperty } from '@nestjs/swagger';
import { OwnReviewItemDto } from './own-review-item.dto';
import { RatingDistributionDto } from './expert-reviews.dto';

// Аналог ExpertReviewsDto для GET /experts/me/reviews — items несут id.
export class MyExpertReviewsDto {
  @ApiProperty({ type: [OwnReviewItemDto] })
  items: OwnReviewItemDto[];

  @ApiProperty({ type: RatingDistributionDto })
  distribution: RatingDistributionDto;

  @ApiProperty()
  ratingAvg: number;

  @ApiProperty()
  ratingCount: number;
}
