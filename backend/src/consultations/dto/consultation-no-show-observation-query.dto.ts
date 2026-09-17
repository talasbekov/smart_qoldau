import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsStrictUtcInstant } from '../../common/validation/strict-utc-instant.validator';

export class ConsultationNoShowObservationQueryDto {
  @ApiProperty({
    format: 'date-time',
    example: '2026-09-17T00:00:00Z',
    description: 'Inclusive UTC endedAt cohort boundary.',
  })
  @IsString()
  @IsStrictUtcInstant()
  from!: string;

  @ApiProperty({
    format: 'date-time',
    example: '2026-09-18T00:00:00Z',
    description: 'Exclusive UTC endedAt cohort boundary.',
  })
  @IsString()
  @IsStrictUtcInstant()
  to!: string;
}
