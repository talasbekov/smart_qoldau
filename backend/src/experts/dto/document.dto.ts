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

  // Только владелец анкеты получает комментарий оператора. Ссылка на файл
  // намеренно не выдаётся: документы остаются закрытыми.
  @ApiProperty({ nullable: true, required: false })
  comment?: string | null;
}

export class SubmitVerificationDto {
  @ApiProperty({ enum: VerificationStatus })
  verificationStatus: VerificationStatus;
}
