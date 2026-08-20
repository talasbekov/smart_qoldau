import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConsultationOutcome, ConsultationStatus } from '@prisma/client';

// Вид консультации со стороны эксперта. PII-инвариант: НИКАКОГО
// userId/phone клиента — только clientCode (как в OfferDto/RequestDto).
export class ConsultationExpertDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ConsultationStatus })
  status: ConsultationStatus;

  @ApiPropertyOptional({ enum: ConsultationOutcome })
  outcome?: ConsultationOutcome | null;

  @ApiProperty({ example: 'video' })
  format: string;

  @ApiProperty()
  isEmergency: boolean;

  @ApiProperty()
  startedAt: Date;

  @ApiPropertyOptional()
  endedAt?: Date | null;

  @ApiProperty({ description: '4-значный код клиента' })
  clientCode: number;

  @ApiProperty()
  topicSlug: string;

  @ApiProperty({ description: 'Цена в тиынах (снапшот на момент матча)' })
  priceTiyn: number;

  @ApiProperty()
  plannedDurationMin: number;
}
