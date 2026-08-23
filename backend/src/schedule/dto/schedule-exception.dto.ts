import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

// Исключение недельного расписания на конкретную дату (E6b, задача 2).
export class ScheduleExceptionDto {
  @ApiProperty({ example: '2026-08-26', description: 'Дата по Алматы' })
  date: string;

  @ApiProperty({ description: 'true — выходной целиком' })
  isDayOff: boolean;

  @ApiPropertyOptional({ nullable: true, description: 'Минуты от полуночи' })
  startMin: number | null;

  @ApiPropertyOptional({ nullable: true })
  endMin: number | null;
}

export class UpsertScheduleExceptionDto {
  @ApiProperty()
  @IsBoolean()
  isDayOff: boolean;

  // Пара границ обязательна при isDayOff: false; проверяется в сервисе —
  // условие зависит от другого поля.
  @ApiPropertyOptional({ minimum: 0, maximum: 1440, example: 720 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  startMin?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 1440, example: 960 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  endMin?: number;
}

export class ListScheduleExceptionsDto {
  @ApiPropertyOptional({ example: '2026-08-26' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-09' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}
