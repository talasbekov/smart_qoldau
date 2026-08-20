import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

// Ответ POST /v1/consultations/:id/pay — только статус холда, без PII карты
// (её видно через GET .../payment).
export class PayResultDto {
  @ApiProperty({ enum: PaymentStatus, example: 'HELD' })
  status: PaymentStatus;
}
