import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { IsEmail, IsString } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ example: 'operator@smartqoldau.kz' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'change-me-0123456789ab' })
  @IsString()
  password: string;
}

export class AdminSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: AdminRole, isArray: true })
  roles: AdminRole[];
}

export class AdminLoginResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty({ type: AdminSummaryDto })
  admin: AdminSummaryDto;
}
