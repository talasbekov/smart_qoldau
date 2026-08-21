import { ApiProperty } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import {
  ArrayNotEmpty,
  IsEmail,
  IsEnum,
  IsString,
  Length,
} from 'class-validator';

export class CreateStaffDto {
  @ApiProperty({ example: 'operator@smartqoldau.kz' })
  @IsEmail()
  email: string;

  // Минимальная длина — базовая гигиена (учётка сотрудника, не клиента):
  // сама политика паролей брифом не описана и не требуется.
  @ApiProperty({ example: 'change-me-0123456789ab', minLength: 10 })
  @IsString()
  @Length(10, 100)
  password: string;

  @ApiProperty({ enum: AdminRole, isArray: true })
  @ArrayNotEmpty()
  @IsEnum(AdminRole, { each: true })
  roles: AdminRole[];
}
