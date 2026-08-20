import { ApiProperty } from '@nestjs/swagger';

// Одна строка разбивки начислений эксперта (только капчур-платежи, Р-02).
export class EarningsItemDto {
  @ApiProperty()
  consultationId: string;

  @ApiProperty({ description: 'Полная цена консультации в тиынах' })
  priceTiyn: number;

  @ApiProperty({ description: 'Комиссия платформы в тиынах' })
  commissionTiyn: number;

  @ApiProperty({
    description: 'Зачислено эксперту в тиынах (priceTiyn - commissionTiyn)',
  })
  netTiyn: number;

  @ApiProperty()
  createdAt: Date;
}
