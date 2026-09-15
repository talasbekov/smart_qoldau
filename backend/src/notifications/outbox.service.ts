import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClockService } from '../common/clock/clock.service';
import { PrismaService } from '../prisma/prisma.service';

// Очередь отправки пушей (E11a, задача 3).
//
// Зачем: `NotificationsService.dispatch()` рассылал пуш по ВСЕМ устройствам
// получателя прямо в пути запроса. На `POST /v1/requests` — самом
// латентно-критичном пути продукта (ТЗ §6: p95 подбора ≤ 5 с) — это N
// сетевых вызовов к провайдеру подряд, каждый со своим таймаутом. Теперь
// путь запроса пишет одну строку, а веером занимается sweep.
@Injectable()
export class OutboxService {
  constructor(
    private prisma: PrismaService,
    private clock: ClockService,
  ) {}

  /// Ставит отправку пуша в очередь. Одна вставка, никаких сетевых вызовов.
  async enqueue(
    params: {
      notificationId: string;
      userId: string;
      type: string;
      payload: Record<string, unknown>;
    },
    client: Pick<Prisma.TransactionClient, 'notificationOutbox'> = this.prisma,
  ): Promise<void> {
    await client.notificationOutbox.create({
      data: {
        notificationId: params.notificationId,
        userId: params.userId,
        type: params.type,
        payload: params.payload as Prisma.InputJsonValue,
        // Готова к отправке немедленно: ближайший тик sweep её и заберёт.
        nextAttemptAt: this.clock.now(),
      },
    });
  }
}
