import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { ArrayNotEmpty, IsBoolean, IsEnum, IsOptional } from 'class-validator';

// Оба поля опциональны — PATCH может менять только роли, только isActive
// или оба сразу. Если roles передан — не может быть пустым (как при
// создании).
export class UpdateStaffDto {
  @ApiPropertyOptional({ enum: AdminRole, isArray: true })
  @IsOptional()
  @ArrayNotEmpty()
  @IsEnum(AdminRole, { each: true })
  roles?: AdminRole[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
