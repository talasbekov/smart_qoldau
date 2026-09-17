import { ApiProperty } from '@nestjs/swagger';

export class VerificationOperationalSignalDto {
  @ApiProperty({ enum: ['verification.queue_over_24h'] })
  signal!: 'verification.queue_over_24h';

  @ApiProperty({ enum: ['ok', 'alerting'] })
  state!: 'ok' | 'alerting';

  @ApiProperty({ example: 24 })
  thresholdHours!: number;

  @ApiProperty({ example: 3 })
  overdueCount!: number;

  @ApiProperty({ example: 90123, nullable: true, type: Number })
  oldestPendingAgeSeconds!: number | null;

  @ApiProperty({ example: 1 })
  missingSubmittedAtCount!: number;

  @ApiProperty({ format: 'date-time' })
  observedAt!: string;
}
