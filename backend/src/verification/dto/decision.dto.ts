import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class DecisionDto {
  @ApiProperty({ description: 'true — одобрить, false — отклонить' })
  @IsBoolean()
  approve: boolean;

  @ApiProperty({
    required: false,
    description: 'Обязателен при approve=false',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  comment?: string;
}
