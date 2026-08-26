import { Injectable } from '@nestjs/common';
import {
  ContentAccess,
  ContentItem,
  ContentKind,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../common/clock/clock.service';
import { apiError } from '../common/filters/app-exception.filter';
import { PremiumService } from '../premium/premium.service';
import { StorageService } from '../storage/storage.service';
import { ContentBodyDto, ContentItemDto } from './dto/content-item.dto';

/// Язык материала. В базе пользователя локаль хранится как `ru | kz`
/// (исторически, вместе с уведомлениями), а поля материала названы по коду
/// языка `kk` — как файлы переводов приложений. Сопоставление живёт здесь и
/// больше нигде.
type ContentLocale = 'ru' | 'kk';

/// Время жизни ссылки на файл. Пятнадцать минут — с запасом на длинную
/// медитацию и без запаса на пересылку ссылки знакомым.
const MEDIA_TTL_SEC = 900;

function localeOf(userLocale: string): ContentLocale {
  return userLocale === 'kz' || userLocale === 'kk' ? 'kk' : 'ru';
}

interface ArticlePayload {
  markdownRu?: string;
  markdownKk?: string;
}

interface AudioPayload {
  audioKey?: string;
}

interface BreathingPayload {
  cycles?: number;
  phases?: { nameRu: string; nameKk: string; seconds: number }[];
}

@Injectable()
export class ContentService {
  constructor(
    private prisma: PrismaService,
    private clock: ClockService,
    private premium: PremiumService,
    private storage: StorageService,
  ) {}

  async list(
    userId: string,
    filter: { kind?: ContentKind; category?: string },
  ): Promise<ContentItemDto[]> {
    const locale = await this.localeOfUser(userId);
    const where: Prisma.ContentItemWhereInput = {
      publishedAt: { not: null },
      ...(filter.kind ? { kind: filter.kind } : {}),
      ...(filter.category ? { category: filter.category } : {}),
      // Материал без перевода на язык пользователя не показывается: экран
      // на чужом языке хуже короткого списка.
      ...(locale === 'kk'
        ? { titleKk: { not: '' } }
        : { titleRu: { not: '' } }),
    };

    const [items, premium] = await Promise.all([
      this.prisma.contentItem.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      }),
      this.premium.isPremiumAt(userId, this.clock.now()),
    ]);

    const progress = await this.prisma.contentProgress.findMany({
      where: { userId, itemId: { in: items.map((i) => i.id) } },
    });
    const positionById = new Map(
      progress.map((p) => [p.itemId, p.positionPermille]),
    );

    return items.map((item) => ({
      ...this.card(item, locale, premium),
      positionPermille: positionById.get(item.id) ?? 0,
    }));
  }

  async byId(userId: string, id: string): Promise<ContentItemDto> {
    const item = await this.findPublished(id);
    const locale = await this.localeOfUser(userId);
    const premium = await this.premium.isPremiumAt(userId, this.clock.now());
    const progress = await this.prisma.contentProgress.findUnique({
      where: { userId_itemId: { userId, itemId: id } },
    });

    return {
      ...this.card(item, locale, premium),
      positionPermille: progress?.positionPermille ?? 0,
      usefulYes: item.usefulYes,
      usefulNo: item.usefulNo,
      body: this.body(item, locale),
    };
  }

  /// Подписанная ссылка на аудио. Здесь и только здесь решается, пускать
  /// ли: ссылка на объект в бакете — это и есть доступ к нему, поэтому
  /// проверка обязана стоять ДО её выдачи, а не рядом с кнопкой в
  /// приложении.
  async media(
    userId: string,
    id: string,
  ): Promise<{ url: string; expiresAt: string }> {
    const item = await this.findPublished(id);
    await this.assertAccess(userId, item);

    const key = (item.payload as AudioPayload).audioKey;
    if (!key) {
      // У статьи и дыхательной техники файла нет. Пустой url на этом месте
      // выглядел бы как «файл потерялся», а это другая история.
      apiError('CONTENT_HAS_NO_MEDIA', 'У материала нет медиафайла', 409);
    }

    const url = await this.storage.contentUrl(key, MEDIA_TTL_SEC);
    return {
      url,
      expiresAt: new Date(
        this.clock.now().getTime() + MEDIA_TTL_SEC * 1000,
      ).toISOString(),
    };
  }

  private async assertAccess(userId: string, item: ContentItem): Promise<void> {
    if (item.access === ContentAccess.FREE) return;
    const premium = await this.premium.isPremiumAt(userId, this.clock.now());
    if (!premium) {
      apiError(
        'PREMIUM_REQUIRED',
        'Материал доступен по подписке Premium',
        403,
      );
    }
  }

  /// Материал существует для клиента, только если опубликован: черновик
  /// редактора неотличим от несуществующего.
  async findPublished(id: string): Promise<ContentItem> {
    const item = await this.prisma.contentItem.findFirst({
      where: { id, publishedAt: { not: null } },
    });
    if (!item) {
      apiError('CONTENT_NOT_FOUND', 'Материал не найден', 404);
    }
    return item;
  }

  private async localeOfUser(userId: string): Promise<ContentLocale> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });
    return localeOf(user?.locale ?? 'ru');
  }

  private card(
    item: ContentItem,
    locale: ContentLocale,
    premium: boolean,
  ): ContentItemDto {
    return {
      id: item.id,
      kind: item.kind,
      access: item.access,
      slug: item.slug,
      category: item.category,
      title: locale === 'kk' ? item.titleKk : item.titleRu,
      summary: locale === 'kk' ? item.summaryKk : item.summaryRu,
      durationSec: item.durationSec,
      coverUrl: item.coverKey,
      locked: item.access === ContentAccess.PREMIUM && !premium,
    };
  }

  private body(
    item: ContentItem,
    locale: ContentLocale,
  ): ContentBodyDto | undefined {
    if (item.kind === ContentKind.ARTICLE) {
      const payload = item.payload as ArticlePayload;
      return {
        markdown:
          (locale === 'kk' ? payload.markdownKk : payload.markdownRu) ?? '',
      };
    }
    if (item.kind === ContentKind.BREATHING) {
      const payload = item.payload as BreathingPayload;
      return {
        cycles: payload.cycles ?? 1,
        phases: (payload.phases ?? []).map((p) => ({
          name: locale === 'kk' ? p.nameKk : p.nameRu,
          seconds: p.seconds,
        })),
      };
    }
    // MEDITATION и MUSIC: тела нет — ссылка выдаётся отдельным запросом,
    // чтобы пейволл стоял ДО неё, а не рядом с кнопкой в приложении.
    return undefined;
  }
}
