import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class SlotDto {
  @ApiProperty({
    example: '2026-08-25T04:00:00.000Z',
    description: 'Начало слота в UTC; клиент показывает его по Алматы',
  })
  startAt: string;
}

export class SlotsResponseDto {
  @ApiProperty({ type: SlotDto, isArray: true })
  items: SlotDto[];
}

export class ListSlotsDto {
  @ApiPropertyOptional({ example: '2026-08-25T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-09-08T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
