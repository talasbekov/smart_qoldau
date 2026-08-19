import { Injectable } from '@nestjs/common';
import { VerificationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExpertsService } from '../experts/experts.service';
import { ExpertPublicDto } from '../experts/dto/expert-public.dto';

@Injectable()
export class FavoritesService {
  constructor(
    private prisma: PrismaService,
    private experts: ExpertsService,
  ) {}

  // Валидация публичности эксперта (findPublicById бросает 404
  // EXPERT_NOT_FOUND для DRAFT/PENDING/blocked/несуществующего), затем
  // upsert по @@id([userId, expertId]) — идемпотентно.
  async addToFavorites(userId: string, expertId: string): Promise<void> {
    await this.experts.findPublicById(expertId);

    await this.prisma.favorite.upsert({
      where: { userId_expertId: { userId, expertId } },
      update: {},
      create: { userId, expertId },
    });
  }

  // Идемпотентно: deleteMany не падает на отсутствующей записи.
  async removeFromFavorites(userId: string, expertId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({
      where: { userId, expertId },
    });
  }

  // Favorite сознательно без FK (решение задачи 1) — join руками:
  // favorites по userId (сортировка по createdAt desc), затем experts по
  // ids с фильтром публичности (VERIFIED + не blocked). Скрытые/удалённые
  // эксперты выпадают из выдачи, связка в БД остаётся.
  async getFavorites(userId: string): Promise<ExpertPublicDto[]> {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (favorites.length === 0) return [];

    const experts = await this.prisma.expert.findMany({
      where: {
        id: { in: favorites.map((f) => f.expertId) },
        verificationStatus: VerificationStatus.VERIFIED,
        isBlocked: false,
      },
      include: { topics: { include: { topic: true } } },
    });
    const byId = new Map(experts.map((e) => [e.id, e]));

    return favorites
      .map((f) => byId.get(f.expertId))
      .filter((e): e is NonNullable<typeof e> => e !== undefined)
      .map((e) => this.experts.toPublicDto(e));
  }
}
