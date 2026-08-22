import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../common/clock/clock.service';
import { EventsService } from '../ws/events.service';
import { apiError } from '../common/filters/app-exception.filter';
import { OutboxService } from './outbox.service';
import { NotificationsListDto } from './dto/notifications-list.dto';
import {
  CRITICAL_TYPES,
  NotificationLocale,
  NotificationType,
  renderTemplate,
} from './notification-templates';

// Единственная точка отправки уведомлений (E9): in-app запись + WS
// notification.new + push на все устройства получателя. Fire-and-forget:
// НИКОГДА не кидает — сбой любого канала логируется и не откатывает
// доменную операцию (паттерн settleSafely E5). Эксперт адресуется через
// Expert.userId — адресат всегда пользователь.
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private clock: ClockService,
    private events: EventsService,
    private outbox: OutboxService,
  ) {}

  async dispatch(
    userId: string,
    type: NotificationType,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await this.dispatchOrThrow(userId, type, data);
    } catch (e) {
      this.logger.warn(
        `dispatch ${type} пользователю ${userId} не удался: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  private async dispatchOrThrow(
    userId: string,
    type: NotificationType,
    data: Record<string, unknown>,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });
    const locale: NotificationLocale = user?.locale === 'kz' ? 'kz' : 'ru';
    const { title, body } = renderTemplate(type, locale, data);

    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        data: data as Prisma.InputJsonValue,
        // Явно из ClockService (а не @default(now()) БД) — иначе 10с-окно
        // SMS-fallback (OfferPushFallbackService, задача 5) не подчиняется
        // виртуальному времени в e2e (тот же паттерн, что и Request.createdAt
        // в RequestsService.create()).
        createdAt: this.clock.now(),
      },
    });

    this.events.emitToUser(userId, 'notification.new', {
      id: notification.id,
      type,
      title,
      body,
      data,
      createdAt: notification.createdAt,
    });

    // ack доставки идёт по notificationId — приложение вызывает
    // POST /v1/notifications/:id/ack, получив пуш.
    const pushData: Record<string, string> = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)]),
    );
    pushData.notificationId = notification.id;
    pushData.type = type;

    // Веер по устройствам снят с пути запроса (E11a, задача 3): здесь
    // остаётся одна вставка в очередь, а рассылкой занимается
    // OutboxSweepService. In-app запись и WS-событие по-прежнему
    // синхронные — это одна вставка и локальный emit, задерживать их
    // нечем, а реалтайм на них держится.
    await this.outbox.enqueue({
      notificationId: notification.id,
      userId,
      type,
      payload: pushData,
    });
  }

  // Диспатч эксперту по Expert.id: резолвит Expert.userId и зовёт dispatch.
  // Снимает дублирование паттерна «findUnique(expert) -> if (userId)
  // dispatch(...)», раньше повторённого по точкам вызова БЕЗ лога в ветке
  // «эксперт не резолвится» — пропавший критичный пуш не оставлял следа.
  // Fire-and-forget как и dispatch(): никогда не бросает (резолв userId
  // обёрнут try/catch), сбой резолва или канала — только warn в лог.
  async dispatchToExpert(
    expertId: string,
    type: NotificationType,
    data: Record<string, unknown> = {},
  ): Promise<void> {
    let userId: string | undefined;
    try {
      const expert = await this.prisma.expert.findUnique({
        where: { id: expertId },
        select: { userId: true },
      });
      userId = expert?.userId;
    } catch (e) {
      this.logger.warn(
        `dispatchToExpert: резолв userId эксперта ${expertId} для ${type} не удался: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
      return;
    }
    if (!userId) {
      this.logger.warn(
        `dispatchToExpert: эксперт ${expertId} не найден, уведомление ${type} не отправлено`,
      );
      return;
    }
    await this.dispatch(userId, type, data);
  }

  // GET /v1/notifications — свои, новые сверху; unreadCount — по всем
  // страницам (бейдж центра).
  async list(
    userId: string,
    filters: { take?: number; skip?: number },
  ): Promise<NotificationsListDto> {
    const take = Math.min(filters.take ?? 20, 100);
    const skip = filters.skip ?? 0;

    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        // Вторичный ключ id — createdAt (ClockService.now(), мс-разрешение)
        // может совпасть у нескольких записей при плотном диспатче
        // (broadcast Р-16 подряд по N экспертам): без тай-брейкера
        // skip/take по неполному ORDER BY недетерминированы между
        // страницами — запись может исчезнуть или задвоиться.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        skip,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return {
      items: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        data: n.data,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      unreadCount,
    };
  }

  // POST /v1/notifications/read — без ids прочитать все свои; чужие id в
  // списке просто не матчатся фильтром userId (не раскрываем 404-ом).
  async markRead(userId: string, ids?: string[]): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
        ...(ids && ids.length ? { id: { in: ids } } : {}),
      },
      data: { readAt: this.clock.now() },
    });
  }

  // POST /v1/notifications/:id/ack — устройство подтверждает доставку пуша.
  // Первый ack фиксирует pushDeliveredAt (метрика §11.6), повтор — no-op.
  async ack(userId: string, notificationId: string): Promise<void> {
    const updated = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId, pushDeliveredAt: null },
      data: { pushDeliveredAt: this.clock.now() },
    });
    if (updated.count === 0) {
      const exists = await this.prisma.notification.findFirst({
        where: { id: notificationId, userId },
        select: { id: true },
      });
      if (!exists) {
        apiError('NOTIFICATION_NOT_FOUND', 'Уведомление не найдено', 404);
      }
    }
  }
}
