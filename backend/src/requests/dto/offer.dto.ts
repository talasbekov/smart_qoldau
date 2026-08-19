import { ApiProperty } from '@nestjs/swagger';

// PII-инвариант: только clientCode, никаких clientUserId/телефона.
export class OfferDto {
  @ApiProperty({ format: 'uuid' })
  offerId: string;

  @ApiProperty({ example: 'anxiety-stress' })
  topicSlug: string;

  @ApiProperty({ example: 'video' })
  format: string;

  @ApiProperty()
  isEmergency: boolean;

  @ApiProperty({ description: '4-значный код клиента' })
  clientCode: number;

  @ApiProperty({ format: 'date-time' })
  deadlineAt: Date;
}
