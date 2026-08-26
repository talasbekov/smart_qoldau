import { Injectable } from '@nestjs/common';
import { ContentItem, ContentKind, Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../common/clock/clock.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/filters/app-exception.filter';
import { PatchContentDto, UpsertContentDto } from './dto/upsert-content.dto';

interface Phase {
  nameRu?: unknown;
  nameKk?: unknown;
  seconds?: unknown;
}

/// Проверка формы тела по виду материала. Материал с пустым телом выглядит
/// целым в списке и ломается ровно у пользователя на экране — поэтому
/// отказываем на входе, а не «разберёмся при показе».
export function assertPayloadShape(
  kind: ContentKind,
  payload: Record<string, unknown>,
): void {
  const fail = (why: string): never =>
    apiError('VALIDATION_FAILED', why, 400) as never;

  if (kind === ContentKind.ARTICLE) {
    const ru = payload.markdownRu;
    const kk = payload.markdownKk;
    if (typeof ru !== 'string' || typeof kk !== 'string') {
      fail('Статье нужны markdownRu и markdownKk');
    }
    return;
  }

  if (kind === ContentKind.BREATHING) {
    const phases = payload.phases;
    if (!Array.isArray(phases) || phases.length === 0) {
      fail('Дыхательной технике нужны фазы');
    }
    for (const phase of phases as Phase[]) {
      if (
        typeof phase?.nameRu !== 'string' ||
        typeof phase?.nameKk !== 'string' ||
        typeof phase?.seconds !== 'number' ||
        phase.seconds <= 0
      ) {
        fail('Фаза описывается nameRu, nameKk и положительным seconds');
      }
    }
    if (typeof payload.cycles !== 'number' || payload.cycles <= 0) {
      fail('Дыхательной технике нужно число циклов');
    }
    return;
  }

  // MEDITATION и MUSIC.
  if (typeof payload.audioKey !== 'string' || payload.audioKey.length === 0) {
    fail('Аудиоматериалу нужен audioKey');
  }
}

@Injectable()
export class ContentAdminService {
  constructor(
    private prisma: PrismaService,
    private clock: ClockService,
    private audit: AuditService,
  ) {}

  /// Список редактора — вместе с черновиками: это его рабочий стол.
  async list(): Promise<ContentItem[]> {
    return this.prisma.contentItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(adminId: string, dto: UpsertContentDto): Promise<ContentItem> {
    assertPayloadShape(dto.kind, dto.payload);

    try {
      const item = await this.prisma.contentItem.create({
        data: {
          kind: dto.kind,
          access: dto.access ?? 'FREE',
          slug: dto.slug,
          category: dto.category,
          titleRu: dto.titleRu,
          titleKk: dto.titleKk,
          summaryRu: dto.summaryRu,
          summaryKk: dto.summaryKk,
          payload: dto.payload as Prisma.InputJsonValue,
          durationSec: dto.durationSec ?? null,
          coverKey: dto.coverKey ?? null,
          sortOrder: dto.sortOrder ?? 0,
          publishedAt: dto.published ? this.clock.now() : null,
        },
      });
      await this.log(adminId, item.id, 'content.created', { slug: item.slug });
      return item;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        apiError('CONTENT_SLUG_TAKEN', 'Материал с таким slug уже есть', 409);
      }
      throw e;
    }
  }

  async patch(
    adminId: string,
    id: string,
    dto: PatchContentDto,
  ): Promise<ContentItem> {
    const existing = await this.prisma.contentItem.findUnique({
      where: { id },
    });
    if (!existing) {
      apiError('CONTENT_NOT_FOUND', 'Материал не найден', 404);
    }
    if (dto.payload) {
      assertPayloadShape(existing.kind, dto.payload);
    }

    const item = await this.prisma.contentItem.update({
      where: { id },
      data: {
        ...(dto.access ? { access: dto.access } : {}),
        ...(dto.titleRu !== undefined ? { titleRu: dto.titleRu } : {}),
        ...(dto.titleKk !== undefined ? { titleKk: dto.titleKk } : {}),
        ...(dto.summaryRu !== undefined ? { summaryRu: dto.summaryRu } : {}),
        ...(dto.summaryKk !== undefined ? { summaryKk: dto.summaryKk } : {}),
        ...(dto.payload
          ? { payload: dto.payload as Prisma.InputJsonValue }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.published === undefined
          ? {}
          : { publishedAt: dto.published ? this.clock.now() : null }),
      },
    });

    if (dto.published !== undefined) {
      await this.log(
        adminId,
        id,
        dto.published ? 'content.published' : 'content.unpublished',
        { slug: item.slug },
      );
    }
    return item;
  }

  async remove(adminId: string, id: string): Promise<void> {
    const item = await this.prisma.contentItem.findUnique({ where: { id } });
    if (!item) {
      apiError('CONTENT_NOT_FOUND', 'Материал не найден', 404);
    }
    // Прогресс и голоса уходят каскадом: без материала они бессмысленны.
    await this.prisma.contentItem.delete({ where: { id } });
    await this.log(adminId, id, 'content.deleted', { slug: item.slug });
  }

  private async log(
    adminId: string,
    itemId: string,
    transition: string,
    payload: object,
  ): Promise<void> {
    await this.audit.log({
      actorType: 'admin',
      actorId: adminId,
      entity: 'content',
      entityId: itemId,
      transition,
      payload,
    });
  }
}
