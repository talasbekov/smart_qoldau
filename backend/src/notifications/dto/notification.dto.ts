import { ApiProperty } from '@nestjs/swagger';

export class NotificationDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'earning.credited' })
  type: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ type: Object })
  data: unknown;

  @ApiProperty({ nullable: true, type: Date })
  readAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}
