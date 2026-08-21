import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class PayConsultationDto {
  @ApiProperty({ format: 'uuid', description: 'Своя живая карта' })
  @IsUUID()
  paymentMethodId: string;
}
