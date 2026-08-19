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

  @ApiProperty({ type: QueueDocumentDto, isArray: true })
  documents: QueueDocumentDto[];
}
