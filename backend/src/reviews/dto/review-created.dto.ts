import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Ответ на POST /v1/consultations/:id/review. Сборка ТОЛЬКО явным
// перечислением полей — privateText НИКОГДА не возвращается автору здесь
// (виден только в админ-API задачи 8), clientUserId/expertId не раскрываются
// вызывающему без необходимости.
export class ReviewCreatedDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  consultationId: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  rating: number;

  @ApiPropertyOptional({ nullable: true })
  publicText: string | null;

  @ApiProperty({ type: String, isArray: true, example: ['attentive'] })
  tags: string[];

  @ApiProperty()
  createdAt: Date;
}
