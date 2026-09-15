import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { apiError } from '../common/filters/app-exception.filter';

// The signed JWT identifies the user; current database state grants access.
// No cache: a completed block/deactivation applies to the next HTTP/WS action.
// DRAFT/PENDING and document re-verification are not account blocks (Р-18).
@Injectable()
export class AccountAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertActive(userId: string): Promise<void> {
    if (typeof userId !== 'string' || !userId) {
      apiError('UNAUTHORIZED', 'Сессия недействительна', 401);
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { deletedAt: true, expert: { select: { isBlocked: true } } },
    });
    if (!user || user.deletedAt) {
      apiError('UNAUTHORIZED', 'Сессия недействительна', 401);
    }
    if (user.expert?.isBlocked) {
      apiError('EXPERT_BLOCKED', 'Профиль заблокирован', 403);
    }
  }
}
