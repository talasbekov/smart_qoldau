import { ApiProperty } from '@nestjs/swagger';
import { AdminPayoutDto } from './admin-payout.dto';

export class AdminPayoutsListDto {
  @ApiProperty({ type: [AdminPayoutDto] })
  items: AdminPayoutDto[];
}
