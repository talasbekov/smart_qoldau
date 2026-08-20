import { ApiProperty } from '@nestjs/swagger';
import { ReviewItemDto } from './review-item.dto';

export class RatingDistributionDto {
  @ApiProperty() 1: number;
  @ApiProperty() 2: number;
  @ApiProperty() 3: number;
  @ApiProperty() 4: number;
  @ApiProperty() 5: number;
}

export class ExpertReviewsDto {
  @ApiProperty({ type: [ReviewItemDto] })
  items: ReviewItemDto[];

  @ApiProperty({ type: RatingDistributionDto })
  distribution: RatingDistributionDto;

  @ApiProperty()
  ratingAvg: number;

  @ApiProperty()
  ratingCount: number;
}
