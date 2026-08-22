import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketStatus, TicketTeam } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

// Очередь сотрудника (GET /v1/admin/tickets, задача 8). status/team —
// необязательные фильтры; team за пределами команд сотрудника даёт пустой
// список (TicketsService.adminList), а не отдельную ошибку.
export class AdminListTicketsDto {
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({ enum: TicketTeam })
  @IsOptional()
  @IsEnum(TicketTeam)
  team?: TicketTeam;

  // Назначение (E11a, задача 8): `me` — мои, `none` — свободные, `any` —
  // все доступные (умолчание). Без этого фильтра очередь общая, и двое
  // операторов берут один тикет.
  @ApiPropertyOptional({ enum: ['me', 'none', 'any'] })
  @IsOptional()
  @IsIn(['me', 'none', 'any'])
  assigned?: 'me' | 'none' | 'any';

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
