import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../common/clock/clock.service';
import { EventsService } from '../ws/events.service';
import { PushProviderPort } from './provider/push-provider.port';
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
}
