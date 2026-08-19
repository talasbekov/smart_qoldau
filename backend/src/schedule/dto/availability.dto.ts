import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateAvailabilityDto {
  @ApiProperty({ description: 'Готовность принимать срочные заявки' })
  @IsBoolean()
  acceptsUrgent: boolean;
}
