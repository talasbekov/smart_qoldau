import { ApiProperty } from '@nestjs/swagger';

// availableTiyn дублирует balanceTiyn сознательно: резерв вывода
// (payout_reserve) списывает деньги со счёта эксперта в момент заявки,
// поэтому баланс ledger уже и есть «доступно к выводу». Отдельное поле —
// явный контракт API на случай, если резервирование изменится.
export class BalanceDto {
  @ApiProperty({ description: 'Баланс счёта эксперта в тиынах' })
  balanceTiyn: number;

  @ApiProperty({ description: 'Доступно к выводу в тиынах' })
  availableTiyn: number;
}
