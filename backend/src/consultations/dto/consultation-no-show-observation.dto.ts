import { ApiProperty } from '@nestjs/swagger';

export class ConsultationNoShowOutcomeCountsDto {
  @ApiProperty({ minimum: 0, example: 8 })
  COMPLETED!: number;

  @ApiProperty({ minimum: 0, example: 1 })
  CLIENT_CANCELLED!: number;

  @ApiProperty({ minimum: 0, example: 2 })
  TECH_ISSUE!: number;

  @ApiProperty({ minimum: 0, example: 0 })
  EXPERT_CANCELLED!: number;
}

export class ConsultationNoShowObservationWindowDto {
  @ApiProperty({ format: 'date-time', example: '2026-09-17T00:00:00Z' })
  from!: string;

  @ApiProperty({ format: 'date-time', example: '2026-09-18T00:00:00Z' })
  to!: string;
}

export class ConsultationNoShowObservationDto {
  @ApiProperty({
    enum: ['consultation.client_no_show_observation'],
    example: 'consultation.client_no_show_observation',
  })
  signal!: 'consultation.client_no_show_observation';

  @ApiProperty({ enum: ['observed'], example: 'observed' })
  state!: 'observed';

  @ApiProperty({ type: ConsultationNoShowObservationWindowDto })
  window!: ConsultationNoShowObservationWindowDto;

  @ApiProperty({ format: 'date-time', example: '2026-09-18T00:00:00.000Z' })
  observedAt!: string;

  @ApiProperty({ minimum: 0, example: 14 })
  cohortCompletedCount!: number;

  @ApiProperty({ minimum: 0, example: 2 })
  clientNoShowOutcomeCount!: number;

  @ApiProperty({ type: ConsultationNoShowOutcomeCountsDto })
  outcomeCounts!: ConsultationNoShowOutcomeCountsDto;

  @ApiProperty({ minimum: 0, example: 1 })
  completedWithoutOutcomeCount!: number;

  @ApiProperty({
    minimum: 0,
    example: 0,
    description:
      'All-time integrity count, separate from the endedAt-bounded cohort.',
  })
  completedWithoutEndedAtCountAllTime!: number;
}
