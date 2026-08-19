import { ApiProperty } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';

export class AcceptOfferDto {
  @ApiProperty({ format: 'uuid' })
  requestId: string;

  @ApiProperty({ enum: RequestStatus, example: 'MATCHED' })
  status: RequestStatus;
}
