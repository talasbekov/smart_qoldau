import { ApiProperty } from '@nestjs/swagger';
import {
  ExperienceLevel,
  ProfileFieldStatus,
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

  // Публичный контент профиля (E2a). Владельцу видно и опубликованное
  // значение, и статус проверки, и причина отказа — иначе он не понимает,
  // почему фото не появилось.
  @ApiProperty({
    nullable: true,
    description: 'Опубликованная фотография; во время проверки — прежняя',
  })
  photoUrl: string | null;

  @ApiProperty({ enum: ProfileFieldStatus })
  photoStatus: ProfileFieldStatus;

  @ApiProperty({ nullable: true, description: 'Опубликованный текст «о себе»' })
  about: string | null;

  @ApiProperty({ enum: ProfileFieldStatus })
  aboutStatus: ProfileFieldStatus;

  @ApiProperty({ nullable: true, description: 'Причина последнего отказа' })
  moderationComment: string | null;
}
