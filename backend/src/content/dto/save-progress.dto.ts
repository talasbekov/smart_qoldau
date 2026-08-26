import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export class SaveProgressDto {
  @ApiProperty({
    minimum: 0,
    maximum: 1000,
    description:
      'Доля прослушанного или прочитанного в промилле. Одно поле на оба ' +
      'вида: длительность известна из карточки.',
  })
  @IsInt()
  @Min(0)
  @Max(1000)
  positionPermille!: number;
}

export class VoteDto {
  @ApiProperty({ description: 'Был ли материал полезен' })
  @IsBoolean()
  useful!: boolean;
}
