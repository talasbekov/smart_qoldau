import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

// Ответ POST /v1/admin/staff — passwordHash никогда не включается.
export class StaffDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ enum: AdminRole, isArray: true })
  roles: AdminRole[];

  @ApiProperty()
  isActive: boolean;
}

// Карточка в GET-списке и ответ PATCH — StaffDto + метаданные входа/создания.
export class StaffCardDto extends StaffDto {
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lastLoginAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class StaffListDto {
  @ApiProperty({ type: [StaffCardDto] })
  items: StaffCardDto[];

  @ApiProperty({ description: 'Всего сотрудников (независимо от страницы)' })
  total: number;
}

export class ListStaffDto {
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;
}
