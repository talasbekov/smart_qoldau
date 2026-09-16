import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// senderRole 'client'|'expert' — НИКАКОГО userId (PII-инвариант чата, как
// clientCode/ExpertPublicDto в консультациях).
export class MessageDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  consultationId: string;

  @ApiProperty({ enum: ['client', 'expert'] })
  senderRole: 'client' | 'expert';

  @ApiPropertyOptional({ format: 'uuid' })
  clientMessageId?: string;

  @ApiProperty()
  text: string;

  @ApiProperty()
  createdAt: Date;
}
