import { ApiProperty } from '@nestjs/swagger';
import {
  DocumentStatus,
  DocumentType,
  VerificationStatus,
} from '@prisma/client';

export class QueueDocumentDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: DocumentType })
  type: DocumentType;

  @ApiProperty({ enum: DocumentStatus })
  status: DocumentStatus;

  @ApiProperty({ description: 'Подписанная ссылка на скачивание, TTL 300с' })
  downloadUrl: string;
}

export class QueueEntryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty({ enum: VerificationStatus })
  verificationStatus: VerificationStatus;

  @ApiProperty({
    nullable: true,
    description:
      'Момент отправки анкеты на проверку — точка отсчёта SLA 24ч (ТЗ §11.4). null только у записей, отправленных до появления поля.',
  })
  submittedAt: Date | null;

  @ApiProperty({ type: QueueDocumentDto, isArray: true })
  documents: QueueDocumentDto[];
}
