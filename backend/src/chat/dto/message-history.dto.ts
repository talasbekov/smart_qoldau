import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageDto } from './message.dto';

export class MessageHistoryDto {
  @ApiProperty({ type: [MessageDto] })
  items: MessageDto[];

  @ApiPropertyOptional({ nullable: true, type: String })
  nextCursor: string | null;
}
