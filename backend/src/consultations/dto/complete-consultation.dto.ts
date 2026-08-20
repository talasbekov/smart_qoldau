import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ConsultationOutcome } from '@prisma/client';

export class CompleteConsultationDto {
  @ApiProperty({ enum: ConsultationOutcome })
  @IsIn(Object.values(ConsultationOutcome))
  outcome!: ConsultationOutcome;
}
