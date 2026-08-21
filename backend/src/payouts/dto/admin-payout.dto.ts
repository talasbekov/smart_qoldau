import { ApiProperty } from '@nestjs/swagger';

// Строка очереди финконтроля: админ видит карту вывода и сумму выводов
// эксперта за месяц — контекст для решения approve/reject.
export class AdminPayoutDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  expertId: string;

  @ApiProperty({ description: 'Сумма вывода в тиынах' })
  amountTiyn: number;

  @ApiProperty({ example: '**** 1111' })
  maskedPan: string;

  @ApiProperty()
  holderName: string;

  @ApiProperty({
    description:
      'Сумма выводов эксперта за текущий календарный месяц (кроме REJECTED), тиын',
  })
  monthTotalTiyn: number;

  @ApiProperty()
  createdAt: Date;
}
