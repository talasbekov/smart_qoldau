import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ScheduleDayDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: '0=Пн … 6=Вс' })
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ description: 'Минуты от полуночи' })
  @IsInt()
  @Min(0)
  @Max(1440)
  startMin: number;

  @ApiProperty({ description: 'Минуты от полуночи' })
  @IsInt()
  @Min(0)
  @Max(1440)
  endMin: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  breakStart?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  breakEnd?: number | null;
}

export class UpdateScheduleDto {
  @ApiProperty({ type: [ScheduleDayDto], description: 'Ровно 7 дней' })
  @ValidateNested({ each: true })
  @Type(() => ScheduleDayDto)
  @ArrayMinSize(7)
  @ArrayMaxSize(7)
  days: ScheduleDayDto[];
}

export class ScheduleResponseDto {
  @ApiProperty({ type: [ScheduleDayDto] })
  days: ScheduleDayDto[];
}
