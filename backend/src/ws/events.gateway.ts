import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ExpertsService } from '../experts/experts.service';
import { EventsService } from './events.service';

interface JwtPayload {
  sub: string;
  isGuest: boolean;
}

// Namespace '/ws' (не engine.io path — избегаем конфликта с socket.io
// дефолтным '/socket.io' путём, см. брифинг задачи 7). Аутентификация —
// handshake.auth.token (JWT access-токен, тот же секрет, что и HTTP-guard).
// Невалидный/отсутствующий токен -> disconnect(true) сразу в
// handleConnection. После верификации клиент join'ится в комнату
// user:{sub}, и, если у пользователя есть экспертный профиль — ещё и в
// expert:{expertId}.
@WebSocketGateway({ namespace: '/ws' })
export class EventsGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private jwt: JwtService,
    private experts: ExpertsService,
    private events: EventsService,
  ) {}

  afterInit(server: Server): void {
    this.events.setServer(server);
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect(true);
      return;
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      client.disconnect(true);
      return;
    }

    await client.join(`user:${payload.sub}`);

    try {
      const expert = await this.experts.findByUserId(payload.sub);
      if (expert) {
        await client.join(`expert:${expert.id}`);
      }
    } catch (e) {
      this.logger.error(
        `failed to resolve expert profile for user ${payload.sub}: ${
          e instanceof Error ? e.message : String(e)
        }`,
        e instanceof Error ? e.stack : undefined,
      );
    }
  }
}
