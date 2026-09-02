import { Injectable } from '@nestjs/common';
import {
  ContentAccess,
  ContentItem,
  ContentKind,
  Prisma,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
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

/// Материал считается пройденным на этой отметке.
const COMPLETE_PERMILLE = 1000;

const DEFAULT_TAKE = 20;
const MAX_TAKE = 100;

/// Обложка — превью карточки, а не платный контент, но лежит в том же
/// закрытом бакете, поэтому ссылку тоже надо подписывать. Живёт дольше
/// аудио: список пролистывают долго, а перезапрашивать карточки ради
/// картинок незачем.
const COVER_TTL_SEC = 3600;

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
    userId: string | null,
    filter: {
      kind?: ContentKind;
      category?: string;
      take?: number;
      skip?: number;
      locale?: string;
    },
  ): Promise<ContentItemDto[]> {
    const locale = await this.localeOfUser(userId, filter.locale);
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
        take: Math.min(filter.take ?? DEFAULT_TAKE, MAX_TAKE),
        skip: filter.skip ?? 0,
      }),
      userId ? this.premium.isPremiumAt(userId, this.clock.now()) : false,
    ]);

    const progress = userId
      ? await this.prisma.contentProgress.findMany({
          where: { userId, itemId: { in: items.map((i) => i.id) } },
        })
      : [];
    const positionById = new Map(
      progress.map((p) => [p.itemId, p.positionPermille]),
    );

    return Promise.all(
      items.map(async (item) => ({
        ...this.card(item, locale, premium),
        coverUrl: await this.coverUrl(item.coverKey),
        positionPermille: positionById.get(item.id) ?? 0,
      })),
    );
  }

  async byId(
    userId: string | null,
    id: string,
    fallbackLocale?: string,
  ): Promise<ContentItemDto> {
    const item = await this.findPublished(id);
    const locale = await this.localeOfUser(userId, fallbackLocale);
    const premium = userId
      ? await this.premium.isPremiumAt(userId, this.clock.now())
      : false;
    const locked = item.access === ContentAccess.PREMIUM && !premium;
    const progress = userId
      ? await this.prisma.contentProgress.findUnique({
          where: { userId_itemId: { userId, itemId: id } },
        })
      : null;

    return {
      ...this.card(item, locale, premium),
      coverUrl: await this.coverUrl(item.coverKey),
      positionPermille: progress?.positionPermille ?? 0,
      usefulYes: item.usefulYes,
      usefulNo: item.usefulNo,
      // Тело — ТОЛЬКО при наличии доступа. У медитации и музыки пейволл
      // стоит на подписанной ссылке, а у статьи и дыхательной практики
      // ссылки нет вовсе: всё содержимое приходит здесь. Без этой
      // проверки платную статью читал любой вошедший.
      body: locked ? undefined : this.body(item, locale),
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

  /// Прогресс — upsert по паре (пользователь, материал). completedAt
  /// ставится на 1000 и больше не сбрасывается: перечитал статью — она не
  /// «разучилась», завершение это факт биографии, а не положение ползунка.
  async saveProgress(
    userId: string,
    id: string,
    positionPermille: number,
  ): Promise<{ positionPermille: number; completed: boolean }> {
    await this.findPublished(id);
    const completedAt =
      positionPermille >= COMPLETE_PERMILLE ? this.clock.now() : undefined;

    const write = () =>
      this.prisma.contentProgress.upsert({
        where: { userId_itemId: { userId, itemId: id } },
        create: {
          userId,
          itemId: id,
          positionPermille,
          completedAt: completedAt ?? null,
        },
        update: {
          positionPermille,
          ...(completedAt ? { completedAt } : {}),
        },
      });

    let row;
    try {
      row = await write();
    } catch (e) {
      // Два параллельных сохранения прогресса (одна и та же статья на двух
      // устройствах) оба видят «строки нет» и оба идут в create — второй
      // упирается в уникальный индекс. Это штатная гонка, а не ошибка
      // пользователя: повтор попадёт уже в ветку update.
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        row = await write();
      } else {
        throw e;
      }
    }

    return {
      positionPermille: row.positionPermille,
      completed: row.completedAt !== null,
    };
  }

  /// Голос «было полезно» — один на пользователя, повтор меняет решение.
  /// Счётчики на карточке пересчитываются в той же транзакции: два числа
  /// обязаны сходиться с числом строк, иначе они врут ровно тогда, когда на
  /// них смотрят.
  async vote(
    userId: string,
    id: string,
    useful: boolean,
  ): Promise<{ usefulYes: number; usefulNo: number }> {
    await this.findPublished(id);

    return this.prisma.$transaction(async (tx) => {
      await tx.contentVote.upsert({
        where: { userId_itemId: { userId, itemId: id } },
        create: { userId, itemId: id, useful },
        update: { useful },
      });
      const [yes, no] = await Promise.all([
        tx.contentVote.count({ where: { itemId: id, useful: true } }),
        tx.contentVote.count({ where: { itemId: id, useful: false } }),
      ]);
      await tx.contentItem.update({
        where: { id },
        data: { usefulYes: yes, usefulNo: no },
      });
      return { usefulYes: yes, usefulNo: no };
    });
  }

  private async assertAccess(userId: string, item: ContentItem): Promise<void> {
    if (item.access === ContentAccess.FREE) return;
    const premium = userId
      ? await this.premium.isPremiumAt(userId, this.clock.now())
      : false;
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

  /// Ключ обложки сам по себе бесполезен приложению: бакет закрыт, и
  /// картинку по нему не загрузить. Поле называлось coverUrl, а содержало
  /// ключ — имя врало, и обложки просто не показались бы.
  private async coverUrl(key: string | null): Promise<string | null> {
    if (!key) return null;
    return this.storage.contentUrl(key, COVER_TTL_SEC);
  }

  // Аноним профиля не имеет: язык приходит из адреса страницы, а не из
  // базы. Публичные страницы материалов существуют ради поиска, и там
  // читателя ещё нет.
  private async localeOfUser(
    userId: string | null,
    fallback?: string,
  ): Promise<ContentLocale> {
    if (!userId) return localeOf(fallback ?? 'ru');

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
      // Заполняется вызывающим: подпись асинхронна, а card() собирает
      // синхронную часть карточки.
      coverUrl: null,
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
