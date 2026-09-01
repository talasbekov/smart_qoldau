import { ApiProperty } from '@nestjs/swagger';

export class PremiumStatusDto {
  @ApiProperty({
    description:
      'Есть ли доступ к Premium прямо сейчас. Остаётся true после отмены ' +
      'до конца оплаченного периода и во время ретраев автопродления (Р-09).',
  })
  active!: boolean;

  @ApiProperty({ enum: ['MONTH', 'YEAR'], nullable: true })
  plan!: 'MONTH' | 'YEAR' | null;

  @ApiProperty({ nullable: true, description: 'Конец оплаченного периода' })
  currentPeriodEnd!: string | null;

  @ApiProperty({ description: 'Отменена клиентом, не продлится' })
  cancelled!: boolean;

  @ApiProperty({
    description: 'Оплата не прошла, идут ретраи — доступ пока сохраняется',
  })
  inGrace!: boolean;
}
