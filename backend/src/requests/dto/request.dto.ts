import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@prisma/client';
import { ExpertPublicDto } from '../../experts/dto/expert-public.dto';

// Ответ клиенту на создание/чтение заявки. Никакого PII эксперта сверх
// ExpertPublicDto; hotlines — заготовка под CALLBACK_REQUESTED (задача 6+).
export class RequestDto {
  @ApiPropertyOptional({ description: 'Тема для актуального счётчика подбора' })
  topicSlug?: string;

  @ApiPropertyOptional({ enum: ['chat', 'audio', 'video'] })
  format?: string;

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: RequestStatus })
  status: RequestStatus;

  @ApiProperty()
  isEmergency: boolean;

  @ApiProperty({ description: '4-значный код клиента, показывается эксперту' })
  clientCode: number;

  @ApiPropertyOptional({ type: ExpertPublicDto })
  matchedExpert?: ExpertPublicDto;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Консультация, созданная при матче (статус MATCHED)',
  })
  consultationId?: string;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['150', '103', '112'],
    description: 'Горячие линии при статусе CALLBACK_REQUESTED',
  })
  hotlines?: string[];
}
