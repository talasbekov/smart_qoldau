import { ApiProperty } from '@nestjs/swagger';

export class PushObservationWindowDto {
  @ApiProperty({ format: 'date-time' })
  from!: string;

  @ApiProperty({ format: 'date-time' })
  to!: string;
}

export class PushObservationDto {
  @ApiProperty({ enum: ['push.offer_observation'] })
  signal!: 'push.offer_observation';

  @ApiProperty({ enum: ['observed'] })
  state!: 'observed';

  @ApiProperty({ type: PushObservationWindowDto })
  window!: PushObservationWindowDto;

  @ApiProperty({ format: 'date-time' })
  observedAt!: string;

  @ApiProperty({ type: 'integer', minimum: 0 })
  completedFanoutCount!: number;

  @ApiProperty({ type: 'integer', minimum: 0 })
  deviceAckCount!: number;

  @ApiProperty({
    type: 'integer',
    minimum: 0,
    description:
      'Completed fanouts with no recorded client ack in the snapshot.',
  })
  unacknowledgedCount!: number;

  @ApiProperty({ type: 'integer', minimum: 0 })
  latencySampleCount!: number;

  @ApiProperty({ type: 'integer', minimum: 0 })
  negativeLatencyCount!: number;

  @ApiProperty({ type: 'number', minimum: 0, nullable: true })
  ackLatencyP95Ms!: number | null;

  @ApiProperty({ type: 'integer', minimum: 0 })
  outboxDeadCount!: number;

  @ApiProperty({ type: 'integer', minimum: 0 })
  closedWithoutRecordedFanoutCount!: number;

  @ApiProperty({ type: 'integer', minimum: 0 })
  missingNotificationForClosedOutboxCount!: number;

  @ApiProperty({ enum: ['not_observed'] })
  providerAcceptance!: 'not_observed';

  @ApiProperty({ enum: ['not_determined_by_source'] })
  delivery!: 'not_determined_by_source';
}
