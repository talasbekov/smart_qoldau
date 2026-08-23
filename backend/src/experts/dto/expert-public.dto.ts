import { ApiProperty } from '@nestjs/swagger';
import { ExperienceLevel, WorkStatus } from '@prisma/client';

// Публичная карточка эксперта. Эталон PII-инварианта проекта: сборка ТОЛЬКО
// явным перечислением полей (без spread модели) — никаких userId/phone/
// documents/verificationStatus/isBlocked/education наружу.
export class ExpertPublicDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  city: string;

  @ApiProperty({ enum: ExperienceLevel })
  experience: ExperienceLevel;

  @ApiProperty({ description: 'Цена в тиынах' })
  priceTiyn: number;

  @ApiProperty({ isArray: true, example: ['ru', 'kz'] })
  languages: string[];

  @ApiProperty({ isArray: true, example: ['chat', 'audio', 'video'] })
  formats: string[];

  @ApiProperty({ isArray: true, example: ['anxiety-stress', 'burnout'] })
  topicSlugs: string[];

  @ApiProperty({ enum: WorkStatus })
  workStatus: WorkStatus;

  @ApiProperty({
    description: 'Средний рейтинг по PUBLISHED-отзывам (0 если отзывов нет)',
  })
  ratingAvg: number;

  @ApiProperty({ description: 'Количество PUBLISHED-отзывов' })
  ratingCount: number;

  // Публичный контент профиля (E2a). Отдаётся ТОЛЬКО одобренное значение:
  // ни то, что на проверке, ни отклонённое наружу не показывается.
  @ApiProperty({ nullable: true, description: 'Одобренная фотография' })
  photoUrl: string | null;

  @ApiProperty({ nullable: true, description: 'Одобренный текст «о себе»' })
  about: string | null;
}
