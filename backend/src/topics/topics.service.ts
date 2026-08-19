import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TopicsService {
  constructor(private prisma: PrismaService) {}

  async list(locale: 'ru' | 'kz' = 'ru') {
    const rows = await this.prisma.topic.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: locale === 'kz' ? t.nameKz : t.nameRu,
    }));
  }
}
