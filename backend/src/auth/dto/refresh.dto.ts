import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty({ description: 'Refresh-токен, выданный ранее' })
  @IsString()
  refreshToken: string;
}
