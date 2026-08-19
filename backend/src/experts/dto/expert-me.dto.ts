import { ApiProperty } from '@nestjs/swagger';
import {
  ExperienceLevel,
  VerificationStatus,
  WorkStatus,
} from '@prisma/client';

// Анкета эксперта для владельца ("me"). Явное перечисление полей — без
// userId/phone (PII-инвариант проекта).
export class ExpertMeDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  city: string;

  @ApiProperty({ enum: ExperienceLevel })
  experience: ExperienceLevel;

  @ApiProperty()
  education: string;

  @ApiProperty({ description: 'Цена в тиынах' })
  priceTiyn: number;

  @ApiProperty({ isArray: true, example: ['ru', 'kz'] })
  languages: string[];

  @ApiProperty({ isArray: true, example: ['chat', 'audio', 'video'] })
  formats: string[];

  @ApiProperty({ isArray: true, example: ['anxiety-stress', 'burnout'] })
  topicSlugs: string[];

  @ApiProperty({ enum: VerificationStatus })
  verificationStatus: VerificationStatus;

  @ApiProperty({ enum: WorkStatus })
  workStatus: WorkStatus;

  @ApiProperty()
  isBlocked: boolean;

  @ApiProperty()
  acceptsUrgent: boolean;
}
