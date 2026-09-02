import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class DailyEarningDto {
  @ApiProperty({ example: '2026-09-01', description: 'Дата по Asia/Almaty' })
  date: string;

  @ApiProperty({ description: 'Доход эксперта за день в тиынах (после комиссии)' })
  amountTiyn: number;

  @ApiProperty({ description: 'Сколько консультаций оплачено в этот день' })
  consultations: number;
}

export class DailyEarningsDto {
  @ApiProperty({ type: [DailyEarningDto] })
  days: DailyEarningDto[];
}

export class ListDailyEarningsDto {
  @ApiPropertyOptional({
    example: '2026-08-01',
    description: 'Начало периода. По умолчанию — 30 дней назад',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-01', description: 'Конец периода. По умолчанию — сегодня' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
