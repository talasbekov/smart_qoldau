import { ApiProperty } from '@nestjs/swagger';
import { ConsultationPaymentStatus, ConsultationStatus } from '@prisma/client';
import { IsIn, IsISO8601, IsString, IsUUID, Length } from 'class-validator';
import { SESSION_FORMATS } from '../../common/constants/session-formats';

export class CreateBookingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  expertId: string;

  @ApiProperty({ example: 'anxiety-stress' })
  @IsString()
  @Length(1, 100)
  topicSlug: string;

  @ApiProperty({ enum: SESSION_FORMATS })
  @IsIn(SESSION_FORMATS)
  format: string;

  @ApiProperty({ example: '2026-08-25T10:00:00.000Z', description: 'UTC' })
  @IsISO8601()
  slotStartAt: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  paymentMethodId: string;
}

export class BookingResultDto {
  @ApiProperty({ format: 'uuid' })
  consultationId: string;

  @ApiProperty({ example: '2026-08-25T10:00:00.000Z' })
  startedAt: string;

  @ApiProperty({ enum: ConsultationStatus })
  status: ConsultationStatus;

  @ApiProperty({ enum: ConsultationPaymentStatus })
  paymentStatus: ConsultationPaymentStatus;
}
