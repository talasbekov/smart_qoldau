import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class BlockExpertDto {
  @ApiProperty({ description: 'Причина блокировки (Р-19)', maxLength: 1000 })
  @IsString()
  @Length(1, 1000)
  reason: string;
}
