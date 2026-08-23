import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ConsultationOutcome,
  ConsultationPaymentStatus,
  ConsultationStatus,
} from '@prisma/client';
import { ExpertPublicDto } from '../../experts/dto/expert-public.dto';

// Вид консультации со стороны клиента. Без clientCode/topicSlug (клиенту не
// нужны — это его же данные/тема он и так знает из заявки), эксперт — полная
// публичная карточка (ExpertPublicDto — эталон PII-инварианта, без userId).
export class ConsultationClientDto {
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

  @ApiProperty({ description: 'Цена в тиынах (снапшот на момент матча)' })
  priceTiyn: number;

  @ApiProperty()
  plannedDurationMin: number;

  @ApiProperty({ enum: ConsultationPaymentStatus })
  paymentStatus: ConsultationPaymentStatus;

  @ApiProperty({ type: ExpertPublicDto })
  expert: ExpertPublicDto;

  // Идентификатор оставленного отзыва (E2a): без него клиент вынужден был
  // помнить его локально и терял при переустановке приложения.
  @ApiProperty({ format: 'uuid', nullable: true })
  reviewId: string | null;
}
