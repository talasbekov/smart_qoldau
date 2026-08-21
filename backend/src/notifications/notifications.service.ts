import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../common/clock/clock.service';
import { EventsService } from '../ws/events.service';
import { apiError } from '../common/filters/app-exception.filter';
import { PushProviderPort } from './provider/push-provider.port';
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
    private push: PushProviderPort,
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

    const devices = await this.prisma.device.findMany({ where: { userId } });
    const critical = CRITICAL_TYPES.has(type);
    // ack доставки идёт по notificationId — приложение вызывает
    // POST /v1/notifications/:id/ack, получив пуш.
    const pushData: Record<string, string> = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)]),
    );
    pushData.notificationId = notification.id;
    pushData.type = type;

    let sentAtLeastOnce = false;
    for (const device of devices) {
      try {
        await this.push.send({
          token: device.token,
          title,
          body,
          data: pushData,
          critical,
        });
        sentAtLeastOnce = true;
      } catch (e) {
        this.logger.warn(
          `push на устройство ${device.id} не отправлен: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }

    if (sentAtLeastOnce) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { pushSentAt: this.clock.now() },
      });
    }
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
        orderBy: { createdAt: 'desc' },
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
