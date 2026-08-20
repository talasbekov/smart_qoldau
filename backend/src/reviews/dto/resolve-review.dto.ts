import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ResolveReviewDto {
  @ApiProperty({ enum: ['hide', 'restore'] })
  @IsIn(['hide', 'restore'])
  action!: 'hide' | 'restore';

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
