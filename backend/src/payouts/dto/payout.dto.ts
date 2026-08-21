import { ApiProperty } from '@nestjs/swagger';
import { PayoutStatus } from '@prisma/client';

export class PayoutDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Сумма вывода в тиынах' })
  amountTiyn: number;

  @ApiProperty({ example: '**** 1111', description: 'Маска карты вывода' })
  maskedPan: string;

  @ApiProperty({ enum: PayoutStatus })
  status: PayoutStatus;

  @ApiProperty({ nullable: true, type: String })
  rejectReason: string | null;

  @ApiProperty()
  createdAt: Date;
}
