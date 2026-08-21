import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

// Тонкая обёртка над socket.io Server: комнаты user:{userId} и
// expert:{expertId} (см. EventsGateway.handleConnection). Все эмиты —
// best-effort (safeEmit try/catch + Logger.error) — сбой WS-рассылки не
// должен ломать бизнес-операцию (создание заявки, accept/decline и т.д.).
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private server: Server | null = null;

  setServer(server: Server): void {
    this.server = server;
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.safeEmit(`user:${userId}`, event, payload);
  }

  emitToExpert(expertId: string, event: string, payload: unknown): void {
    this.safeEmit(`expert:${expertId}`, event, payload);
  }

  // Есть ли у пользователя хотя бы один живой WS-сокет (комната user:{id}).
  // Нужно чат-пушу (E9): онлайн-получатель видит сообщение в чате, пуш —
  // только офлайновому. Best-effort: при недоступном сервере считаем
  // офлайн (пуш лишний раз лучше, чем пропущенное сообщение).
  isUserConnected(userId: string): boolean {
    try {
      if (!this.server) return false;
      const room = this.server.sockets.adapter.rooms.get(`user:${userId}`);
      return !!room && room.size > 0;
    } catch {
      return false;
    }
  }

  private safeEmit(room: string, event: string, payload: unknown): void {
    try {
      if (!this.server) return;
      this.server.to(room).emit(event, payload);
    } catch (e) {
      this.logger.error(
        `emit failed room=${room} event=${event}: ${
          e instanceof Error ? e.message : String(e)
        }`,
        e instanceof Error ? e.stack : undefined,
      );
    }
  }
}
