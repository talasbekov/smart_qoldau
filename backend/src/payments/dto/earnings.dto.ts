import { ApiProperty } from '@nestjs/swagger';
import { EarningsItemDto } from './earnings-item.dto';

// GET /v1/experts/me/earnings — список capture-начислений + текущий баланс
// эксперта (из ledger).
export class EarningsDto {
  @ApiProperty({ description: 'Текущий баланс эксперта в тиынах (из ledger)' })
  balanceTiyn: number;

  @ApiProperty({ type: [EarningsItemDto] })
  items: EarningsItemDto[];
}
