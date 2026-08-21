import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

// Причина обязательна — Р-06 «отклонение с причиной».
export class RejectPayoutDto {
  @ApiProperty({ example: 'Подозрительная активность' })
  @IsString()
  @Length(1, 500)
  reason: string;
}
