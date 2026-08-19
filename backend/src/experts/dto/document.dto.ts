import { ApiProperty } from '@nestjs/swagger';
import {
  DocumentStatus,
  DocumentType,
  VerificationStatus,
} from '@prisma/client';

export class ExpertDocumentDto {
  @ApiProperty({ enum: DocumentType })
  type: DocumentType;

  @ApiProperty({ enum: DocumentStatus, nullable: true })
  status: DocumentStatus | null;

  @ApiProperty({ required: false, format: 'date-time' })
  updatedAt?: Date;
}

export class SubmitVerificationDto {
  @ApiProperty({ enum: VerificationStatus })
  verificationStatus: VerificationStatus;
}
