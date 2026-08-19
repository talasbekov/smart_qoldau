import { ApiProperty } from '@nestjs/swagger';

export class TopicDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'anxiety-stress' })
  slug: string;

  @ApiProperty({ example: 'Тревога и стресс' })
  name: string;
}
