import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { WorkStatus } from '@prisma/client';

export class WorkStatusDto {
  @ApiProperty({ enum: WorkStatus })
  @IsIn(Object.values(WorkStatus))
  workStatus: WorkStatus;
}
