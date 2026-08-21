import { ApiPropertyOptional } from '@nestjs/swagger';
import { PayoutStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListAdminPayoutsDto {
  @ApiPropertyOptional({
    enum: PayoutStatus,
    default: PayoutStatus.PENDING_REVIEW,
  })
  @IsOptional()
  @IsEnum(PayoutStatus)
  status?: PayoutStatus;
}
