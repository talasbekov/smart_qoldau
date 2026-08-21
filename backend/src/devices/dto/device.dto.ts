import { ApiProperty } from '@nestjs/swagger';
import { DevicePlatform } from '@prisma/client';

export class DeviceDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: DevicePlatform })
  platform: DevicePlatform;

  @ApiProperty()
  token: string;

  @ApiProperty({ example: 'ru' })
  locale: string;
}
