import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { HttpException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Consultation } from '@prisma/client';
import { ExpertsService } from '../experts/experts.service';
import { EventsService } from './events.service';
import { ChatService, SenderRole } from '../chat/chat.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

import { JwtPayload } from '../auth/jwt.strategy';
import { AccountAccessService } from '../auth/account-access.service';

interface SocketData {
  userId: string;
  expertId?: string;
}

interface ChatSendPayload {
  consultationId: string;
  text: string;
}

interface ChatTypingPayload {
  consultationId: string;
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
    private chat: ChatService,
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private access: AccountAccessService,
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
      if (payload.isAdmin) {
        client.disconnect(true);
        return;
      }
      await this.access.assertActive(payload.sub);
    } catch {
      client.disconnect(true);
      return;
    }

    if (!client.connected) return;
    await client.join(`user:${payload.sub}`);

    const data: SocketData = { userId: payload.sub };

    try {
      const expert = await this.experts.findByUserId(payload.sub);
      if (expert) {
        await client.join(`expert:${expert.id}`);
        data.expertId = expert.id;
      }
    } catch (e) {
      this.logger.error(
        `failed to resolve expert profile for user ${payload.sub}: ${
          e instanceof Error ? e.message : String(e)
        }`,
        e instanceof Error ? e.stack : undefined,
      );
    }

    // Готовность подписок: socket.io шлёт клиенту 'connect' сразу после
    // рукопожатия, а комнаты (user:{sub}, expert:{id}) назначаются здесь —
    // асинхронно, с запросом в БД. До этого момента адресные события
    // уходят в пустоту. Живому приложению это незаметно (человек не
    // начинает печатать в ту же миллисекунду), но полагаться на удачу
    // нельзя: тот, кому важно не пропустить событие, ждёт 'ready'.
    if (!client.connected) return;
    client.data = data;
    client.emit('ready', { expertId: data.expertId ?? null });
  }

  // Персист + рассылка в ОБЕ комнаты (user:{clientUserId} и
  // expert:{expertId}) — отправитель тоже получает своё сообщение (проще
  // клиенту: единый путь рендера вместо optimistic-update). Ошибки — НЕ
  // бросаем исключение из хендлера (иначе socket.io закроет соединение) —
  // единообразный client.emit('chat.error', {code}).
  @SubscribeMessage('chat.send')
  async handleChatSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatSendPayload,
  ): Promise<void> {
    const data = client.data as SocketData | undefined;
    if (!data?.userId || !(await this.authorizeAction(client, data))) return;

    try {
      const resolved = await this.chat.resolveParticipant(
        payload?.consultationId,
        data.userId,
      );
      const message = await this.chat.sendResolved(
        resolved.consultation,
        resolved.role,
        payload?.text,
      );
      this.events.emitToUser(
        resolved.consultation.clientUserId,
        'chat.message',
        message,
      );
      this.events.emitToExpert(
        resolved.consultation.expertId,
        'chat.message',
        message,
      );

      // Чат-пуш офлайн-получателю (E9, задача 7): сообщение уже сохранено и
      // разослано выше — pushOfflineRecipient сама глотает свои ошибки
      // (как dispatch()), сбой push-логики никогда не всплывёт в
      // client.emit('chat.error') отправителю.
      await this.pushOfflineRecipient(resolved.consultation, resolved.role);
    } catch (e) {
      const code =
        e instanceof HttpException
          ? ((e.getResponse() as { code?: string })?.code ?? 'INTERNAL')
          : 'INTERNAL';
      client.emit('chat.error', { code });
    }
  }

  // Ретрансляция ТОЛЬКО второй стороне (не отправителю), без персиста.
  // Не участник -> молча игнор (без chat.error — typing не критичен).
  @SubscribeMessage('chat.typing')
  async handleChatTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ChatTypingPayload,
  ): Promise<void> {
    const data = client.data as SocketData | undefined;
    if (!data?.userId || !(await this.authorizeAction(client, data))) return;
    if (!payload?.consultationId) return;

    try {
      const { consultation, role } = await this.chat.resolveParticipant(
        payload.consultationId,
        data.userId,
      );
      const typing = {
        consultationId: payload.consultationId,
        senderRole: role,
      };
      if (role === 'client') {
        this.events.emitToExpert(consultation.expertId, 'chat.typing', typing);
      } else {
        this.events.emitToUser(
          consultation.clientUserId,
          'chat.typing',
          typing,
        );
      }
    } catch {
      // не участник/консультация не найдена -> молча игнор
    }
  }

  // A socket can outlive the account's access. Fail closed before resolving
  // participants or producing any event; disconnect also removes room access.
  private async authorizeAction(
    client: Socket,
    data?: SocketData,
  ): Promise<boolean> {
    if (!client.connected || !data?.userId) return false;
    try {
      await this.access.assertActive(data.userId);
      return client.connected;
    } catch {
      client.disconnect(true);
      return false;
    }
  }

  // Получатель — вторая сторона диалога относительно отправителя (role).
  // Офлайн (нет живого сокета в комнате user:{id}) -> dispatch chat.message
  // без текста сообщения, только consultationId для диплинка. Онлайн ->
  // ничего не шлём (центр не дублирует живой чат). notifications.dispatch()
  // сам никогда не бросает; try/catch здесь — на случай сбоя резолва
  // получателя (expert.findUnique), чтобы он тоже не всплыл в
  // client.emit('chat.error') вызывающего handleChatSend.
  private async pushOfflineRecipient(
    consultation: Consultation,
    senderRole: SenderRole,
  ): Promise<void> {
    try {
      const recipientUserId =
        senderRole === 'client'
          ? await this.expertUserId(consultation.expertId)
          : consultation.clientUserId;
      if (recipientUserId && !this.events.isUserConnected(recipientUserId)) {
        await this.notifications.dispatch(recipientUserId, 'chat.message', {
          consultationId: consultation.id,
        });
      }
    } catch (e) {
      this.logger.error(
        `chat push для консультации ${consultation.id} не отправлен: ${
          e instanceof Error ? e.message : String(e)
        }`,
        e instanceof Error ? e.stack : undefined,
      );
    }
  }

  private async expertUserId(expertId: string): Promise<string | null> {
    const expert = await this.prisma.expert.findUnique({
      where: { id: expertId },
      select: { userId: true },
    });
    return expert?.userId ?? null;
  }
}
