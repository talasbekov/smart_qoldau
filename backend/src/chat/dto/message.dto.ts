import { ApiProperty } from '@nestjs/swagger';

// senderRole 'client'|'expert' — НИКАКОГО userId (PII-инвариант чата, как
// clientCode/ExpertPublicDto в консультациях).
export class MessageDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  consultationId: string;

  @ApiProperty({ enum: ['client', 'expert'] })
  senderRole: 'client' | 'expert';

  @ApiProperty()
  text: string;

  @ApiProperty()
  createdAt: Date;
}
