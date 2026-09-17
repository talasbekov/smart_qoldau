import { ApiProperty } from '@nestjs/swagger';
import { SETTLE_MAX_ATTEMPTS } from '../settle.constants';

export class PaymentOperationalSignalDto {
  @ApiProperty({ enum: ['payment.settle_exhausted'] })
  signal!: 'payment.settle_exhausted';

  @ApiProperty({
    enum: ['alerting', 'unknown', 'ok'],
    description:
      'Local snapshot only: ok means no exhausted or unexpected-context HELD payments; it does not establish provider outcome or financial resolution.',
  })
  state!: 'alerting' | 'unknown' | 'ok';

  @ApiProperty({ enum: [SETTLE_MAX_ATTEMPTS] })
  maxAttempts!: typeof SETTLE_MAX_ATTEMPTS;

  @ApiProperty({ type: 'integer', minimum: 0 })
  currentExhaustedCount!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description:
      'HELD payments at the attempt limit outside a COMPLETED/CANCELLED consultation, including missing consultations.',
  })
  unexpectedContextCount!: number;

  @ApiProperty({ enum: ['not_determined_by_source'] })
  providerOutcome!: 'not_determined_by_source';

  @ApiProperty({ format: 'date-time' })
  observedAt!: string;
}
