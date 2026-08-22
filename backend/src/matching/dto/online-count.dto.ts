import { ApiProperty } from '@nestjs/swagger';

// Только число — никаких id экспертов наружу (см. task-9-brief.md,
// «Никакого PII наружу»).
export class OnlineCountDto {
  @ApiProperty({ example: 3, description: 'Число подходящих экспертов онлайн' })
  count: number;
}
