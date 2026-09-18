import { Injectable, Logger } from '@nestjs/common';
import { ContentItem, ContentKind, Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../common/clock/clock.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/filters/app-exception.filter';
import { StorageService } from '../storage/storage.service';
import { PatchContentDto, UpsertContentDto } from './dto/upsert-content.dto';

interface Phase {
  nameRu?: unknown;
  nameKk?: unknown;
  seconds?: unknown;
}

/// Проверка формы тела по виду материала. Материал с пустым телом выглядит
/// целым в списке и ломается ровно у пользователя на экране — поэтому
/// отказываем на входе, а не «разберёмся при показе».
export function assertStoredPayloadShape(
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

function isAudioKind(kind: ContentKind): boolean {
  return kind === ContentKind.MEDITATION || kind === ContentKind.MUSIC;
}

function payloadObject(payload: Prisma.JsonValue): Record<string, unknown> {
  if (
    payload === null ||
    Array.isArray(payload) ||
    typeof payload !== 'object'
  ) {
    return {};
  }
  return payload as Record<string, unknown>;
}

function audioKeyFrom(payload: Prisma.JsonValue): string | undefined {
  const key = payloadObject(payload).audioKey;
  return typeof key === 'string' && key.length > 0 ? key : undefined;
}

function isOwnedAudioKey(itemId: string, key: string): boolean {
  const parts = key.split('/');
  return (
    parts.length === 3 &&
    parts[0] === 'content' &&
    parts[1] === itemId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.mp3$/.test(
      parts[2],
    )
  );
}

@Injectable()
export class ContentAdminService {
  private readonly logger = new Logger(ContentAdminService.name);

  constructor(
    private prisma: PrismaService,
    private clock: ClockService,
    private audit: AuditService,
    private storage: StorageService,
  ) {}

  /// Список редактора — вместе с черновиками: это его рабочий стол.
  async list(): Promise<ContentItem[]> {
    return this.prisma.contentItem.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(adminId: string, dto: UpsertContentDto): Promise<ContentItem> {
    if (isAudioKind(dto.kind)) {
      if (dto.published === true || Object.keys(dto.payload).length !== 0) {
        apiError(
          'VALIDATION_FAILED',
          'Аудиоматериал сначала создаётся черновиком без ключа файла',
          400,
        );
      }
    } else {
      assertStoredPayloadShape(dto.kind, dto.payload);
    }

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
    if (isAudioKind(existing.kind)) {
      if (dto.payload !== undefined) {
        apiError(
          'VALIDATION_FAILED',
          'Аудиофайл меняется только через загрузчик',
          400,
        );
      }
      if (dto.published === true) {
        assertStoredPayloadShape(
          existing.kind,
          payloadObject(existing.payload),
        );
      }
    } else if (dto.payload) {
      assertStoredPayloadShape(existing.kind, dto.payload);
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

  async uploadAudio(
    adminId: string,
    id: string,
    file: Express.Multer.File,
  ): Promise<ContentItem> {
    const existing = await this.prisma.contentItem.findUnique({
      where: { id },
    });
    if (!existing) {
      apiError('CONTENT_NOT_FOUND', 'Материал не найден', 404);
    }
    if (!isAudioKind(existing.kind)) {
      apiError(
        'VALIDATION_FAILED',
        'Аудио можно загрузить только для медитации или музыки',
        400,
      );
    }

    const oldKey = audioKeyFrom(existing.payload);
    const newKey = `content/${id}/${randomUUID()}.mp3`;
    await this.storage.putContentObject(newKey, file.buffer, 'audio/mpeg');

    let committed: ContentItem | undefined;
    try {
      const updated = await this.prisma.contentItem.updateManyAndReturn({
        where: {
          id,
          payload: { equals: existing.payload as Prisma.InputJsonValue },
        },
        data: { payload: { audioKey: newKey } },
      });
      committed = updated[0];
    } catch (databaseError) {
      let current: ContentItem | null;
      try {
        current = await this.prisma.contentItem.findUnique({ where: { id } });
      } catch (refreshError) {
        this.logger.warn(
          `Audio commit outcome is ambiguous for content ${id}; preserving ${newKey}: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`,
        );
        throw databaseError;
      }

      if (current && audioKeyFrom(current.payload) === newKey) {
        committed = current;
        this.logger.warn(
          `Audio commit for content ${id} was confirmed only by refresh after an update error`,
        );
      } else {
        await this.deleteOwnedIfUnreferenced(id, newKey, 'failed upload');
        throw databaseError;
      }
    }

    if (!committed) {
      let current: ContentItem | null;
      try {
        current = await this.prisma.contentItem.findUnique({ where: { id } });
      } catch (refreshError) {
        this.logger.warn(
          `Audio replacement outcome could not be refreshed for content ${id}; preserving ${newKey}: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`,
        );
        throw refreshError;
      }
      if (current && audioKeyFrom(current.payload) === newKey) {
        committed = current;
      } else {
        await this.deleteOwnedIfUnreferenced(id, newKey, 'lost replacement');
        if (!current) {
          apiError('CONTENT_NOT_FOUND', 'Материал не найден', 404);
        }
        apiError(
          'CONTENT_AUDIO_CHANGED',
          'Аудиофайл уже изменён другим редактором',
          409,
        );
      }
    }

    if (oldKey && oldKey !== newKey) {
      await this.deleteOwnedIfUnreferenced(id, oldKey, 'replaced audio');
    }
    await this.logAfterCommit(adminId, id, 'content.audio_uploaded', {
      replaced: Boolean(oldKey),
    });
    return committed;
  }

  async remove(adminId: string, id: string): Promise<void> {
    let item: ContentItem;
    try {
      // Возвращённая delete() строка и есть состояние под блокировкой БД.
      // Поэтому конкурентная загрузка либо попадёт в эту строку и её объект
      // будет удалён, либо проиграет условный update и уберёт свой объект сама.
      item = await this.prisma.contentItem.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        apiError('CONTENT_NOT_FOUND', 'Материал не найден', 404);
      }
      throw error;
    }
    const audioKey = isAudioKind(item.kind)
      ? audioKeyFrom(item.payload)
      : undefined;
    if (audioKey) {
      await this.deleteOwnedIfUnreferenced(id, audioKey, 'deleted content');
    }
    await this.logAfterCommit(adminId, id, 'content.deleted', {
      slug: item.slug,
    });
  }

  private async deleteOwnedIfUnreferenced(
    itemId: string,
    key: string,
    context: string,
  ): Promise<void> {
    if (!isOwnedAudioKey(itemId, key)) {
      this.logger.warn(
        `Retaining legacy or unowned audio key ${key} for content ${itemId} (${context})`,
      );
      return;
    }

    let reference: { id: string } | null;
    try {
      reference = await this.prisma.contentItem.findFirst({
        where: { payload: { path: ['audioKey'], equals: key } },
        select: { id: true },
      });
    } catch (error) {
      this.logger.warn(
        `Could not confirm that audio ${key} is unreferenced for content ${itemId}; preserving it: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    if (reference) {
      this.logger.warn(
        `Audio ${key} is still referenced by content ${reference.id}; preserving it`,
      );
      return;
    }

    try {
      await this.storage.deleteContentObject(key);
    } catch (error) {
      this.logger.warn(
        `Failed to delete audio ${key} for content ${itemId} (${context}): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async logAfterCommit(
    adminId: string,
    itemId: string,
    transition: string,
    payload: object,
  ): Promise<void> {
    try {
      await this.log(adminId, itemId, transition, payload);
    } catch (error) {
      this.logger.warn(
        `State change ${transition} already committed for content ${itemId}, but audit logging failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
