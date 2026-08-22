import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

// Назначение обращения сотруднику (E11a, задача 8). Пустое тело или
// `adminUserId: null` — снять назначение и вернуть тикет в общую очередь.
export class AssignTicketDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Кому назначить. Не передан — назначить себе; null — снять назначение',
  })
  @IsOptional()
  @IsUUID()
  adminUserId?: string | null;
}
