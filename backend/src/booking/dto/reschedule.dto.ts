import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';

export class RescheduleDto {
  @ApiProperty({ example: '2026-08-25T12:00:00.000Z', description: 'UTC' })
  @IsISO8601()
  slotStartAt: string;
}
