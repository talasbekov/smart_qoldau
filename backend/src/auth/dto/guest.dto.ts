import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class GuestDto {
  @ApiProperty({
    example: 'a1b2c3d4-device-uuid',
    description: 'Уникальный идентификатор устройства гостя',
  })
  @IsString()
  @MinLength(1)
  deviceId: string;
}
