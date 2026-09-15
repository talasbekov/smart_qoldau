import { Injectable, Logger } from '@nestjs/common';
import { Namespace, Server } from 'socket.io';
import { AccountAccessService } from '../auth/account-access.service';
import { PrismaService } from '../prisma/prisma.service';

// Тонкая обёртка над socket.io Server: комнаты user:{userId} и
// expert:{expertId} (см. EventsGateway.handleConnection). Все эмиты —
// best-effort (safeEmit + terminal catch) — сбой WS-рассылки не
// должен ломать бизнес-операцию (создание заявки, accept/decline и т.д.).
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private server: Server | null = null;
  private readonly roomTails = new Map<string, Promise<void>>();

  constructor(
    private readonly access: AccountAccessService,
    private readonly prisma: PrismaService,
  ) {}

  setServer(server: Server): void {
    this.server = server;
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.emit('user', userId, event, payload);
  }

  emitToExpert(expertId: string, event: string, payload: unknown): void {
    this.emit('expert', expertId, event, payload);
  }

  // Есть ли у пользователя хотя бы один живой WS-сокет (комната user:{id}).
  // Нужно чат-пушу (E9): онлайн-получатель видит сообщение в чате, пуш —
  // только офлайновому. Best-effort: при недоступном сервере считаем
  // офлайн (пуш лишний раз лучше, чем пропущенное сообщение).
  // this.server — рантайм это Namespace ('/ws', см. EventsGateway), а не
  // корневой Server: adapter лежит прямо на неймспейсе (namespace.adapter —
  // свойство Adapter), НЕ под namespace.sockets (там Map<SocketId, Socket>
  // без .adapter) и не как у Server (там adapter() — метод смены класса
  // адаптера, не инстанс). Поле типизировано как Server (см. setServer) —
  // приводим к Namespace ради .adapter.rooms.
  isUserConnected(userId: string): boolean {
    try {
      if (!this.server) return false;
      const namespace = this.server as unknown as Namespace;
      const room = namespace.adapter.rooms.get(`user:${userId}`);
      return !!room && room.size > 0;
    } catch {
      return false;
    }
  }

  // Preserve the void, non-blocking contract for every business caller:
  // DB/realtime latency or failure must not hold a transaction or outbox insert.
  // The async operation has a terminal rejection handler owned by this service.
  private emit(
    kind: 'user' | 'expert',
    id: string,
    event: string,
    payload: unknown,
  ): void {
    const room = `${kind}:${id}`;
    // Serialize only this room on this emitter instance. Check access when the
    // event reaches the head, not when queued; slow DB checks cannot invert
    // offer.new/offer.revoked. Other rooms keep making progress independently.
    const previous = this.roomTails.get(room) ?? Promise.resolve();
    const pending = previous
      .then(() => this.safeEmit(kind, id, room, event, payload))
      .catch((e: unknown) => {
        this.logger.error(
          `emit failed room=${room} event=${event}: ${
            e instanceof Error ? e.message : String(e)
          }`,
          e instanceof Error ? e.stack : undefined,
        );
      })
      .finally(() => {
        // A completed element must not delete the tail of a newer element.
        if (this.roomTails.get(room) === pending) this.roomTails.delete(room);
      });
    this.roomTails.set(room, pending);
  }

  private async safeEmit(
    kind: 'user' | 'expert',
    id: string,
    room: string,
    event: string,
    payload: unknown,
  ): Promise<void> {
    const server = this.server;
    if (!server) return;
    const rooms = [room];
    try {
      let userId = id;
      if (kind === 'expert') {
        const expert = await this.prisma.expert.findUnique({
          where: { id },
          select: { userId: true },
        });
        if (!expert) throw new Error('Recipient expert not found');
        userId = expert.userId;
        rooms.push(`user:${userId}`);
      }
      // Current account state, NOT per-socket JWT expiry/session revocation.
      // No cache: a completed denial applies to the next recipient check.
      await this.access.assertActive(userId);
    } catch (e) {
      // Disconnect locally even if Redis cannot publish. The second operation
      // addresses the same rooms across ALL adapter instances (no local map).
      // If expert resolution failed, its room still identifies its ready sockets.
      try {
        server.local.in(rooms).disconnectSockets(true);
      } finally {
        server.in(rooms).disconnectSockets(true);
      }
      throw e;
    }
    server.to(room).emit(event, payload);
  }
}
