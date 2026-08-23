import { Injectable } from '@nestjs/common';
import { ProfileFieldStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  ModeratedField,
  ProfileModerationService,
} from '../experts/profile-moderation.service';
import {
  ModerationDecisionDto,
  ModerationQueueDto,
} from './dto/moderation-queue.dto';

@Injectable()
export class ProfileModerationQueueService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private moderation: ProfileModerationService,
  ) {}

  async queue(query: {
    take?: number;
    skip?: number;
  }): Promise<ModerationQueueDto> {
    const where = {
      OR: [
        { photoStatus: ProfileFieldStatus.PENDING },
        { aboutStatus: ProfileFieldStatus.PENDING },
      ],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.expert.findMany({
        where,
        // Первым — ждущий дольше всех; id вторичным ключом, иначе страницы
        // разъезжаются при одинаковых createdAt.
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: query.take ?? 20,
        skip: query.skip ?? 0,
      }),
      this.prisma.expert.count({ where }),
    ]);

    return {
      items: rows.map((expert) => ({
        expertId: expert.id,
        displayName: expert.displayName,
        photoPendingUrl: expert.photoPendingKey
          ? this.storage.avatarUrl(expert.photoPendingKey)
          : null,
        aboutPending: expert.aboutPending,
        submittedAt: expert.createdAt,
      })),
      total,
    };
  }

  decide(
    expertId: string,
    field: ModeratedField,
    dto: ModerationDecisionDto,
    adminId: string,
  ): Promise<void> {
    return dto.action === 'approve'
      ? this.moderation.approve(expertId, field, adminId)
      : this.moderation.reject(expertId, field, adminId, dto.comment ?? '');
  }
}
