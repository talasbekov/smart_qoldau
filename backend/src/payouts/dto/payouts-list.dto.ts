import { ApiProperty } from '@nestjs/swagger';
import { PayoutDto } from './payout.dto';

export class PayoutsListDto {
  @ApiProperty({ type: [PayoutDto] })
  items: PayoutDto[];
}
