import { ApiProperty } from '@nestjs/swagger';

export class ClientCardDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Как клиент попросил к нему обращаться' })
  displayName: string;

  @ApiProperty({ description: 'Сколько встреч было после согласия' })
  consultations: number;

  @ApiProperty({ type: String, nullable: true, description: 'Последняя встреча' })
  lastAt: Date | null;
}

export class ClientHistoryItemDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: String, nullable: true })
  startedAt: Date | null;

  @ApiProperty({ type: String, nullable: true })
  endedAt: Date | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  topicSlug: string;

  @ApiProperty({
    description:
      'Есть ли заметка. Текст не отдаётся: он зашифрован и читается в самой консультации',
  })
  hasNote: boolean;
}

export class ClientDetailDto extends ClientCardDto {
  @ApiProperty({ type: [ClientHistoryItemDto] })
  history: ClientHistoryItemDto[];
}
