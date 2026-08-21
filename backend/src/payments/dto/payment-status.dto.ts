import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

// GET /v1/consultations/:id/payment — только клиент-участник (PII платежа:
// maskedPan). Эксперту эта информация недоступна — 404 CONSULTATION_NOT_FOUND.
export class PaymentStatusDto {
  @ApiProperty({ enum: PaymentStatus })
  status: PaymentStatus;

  @ApiProperty({ description: 'Полная цена в тиынах (снапшот)' })
  amountTiyn: number;

  @ApiProperty({ example: '**** 1111' })
  maskedPan: string;
}
