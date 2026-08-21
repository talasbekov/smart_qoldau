import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DevicePlatform } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, Length } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ enum: DevicePlatform })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;

  @ApiProperty({ description: 'FCM/APNs push-токен устройства' })
  @IsString()
  @Length(1, 4096)
  token: string;

  @ApiPropertyOptional({ enum: ['ru', 'kz'], description: 'Локаль устройства' })
  @IsOptional()
  @IsIn(['ru', 'kz'])
  locale?: string;
}
