import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ConsultationStatus } from '@prisma/client';

export class ListConsultationsDto {
  @ApiPropertyOptional({ enum: ConsultationStatus })
  @IsOptional()
  @IsIn(Object.values(ConsultationStatus))
  status?: ConsultationStatus;

  // Пользователь может одновременно быть и клиентом, и экспертом — по
  // умолчанию список берётся со стороны клиента (наиболее частый сценарий),
  // as=expert переключает на список консультаций как эксперта.
  @ApiPropertyOptional({ enum: ['client', 'expert'], default: 'client' })
  @IsOptional()
  @IsIn(['client', 'expert'])
  as?: 'client' | 'expert';

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
