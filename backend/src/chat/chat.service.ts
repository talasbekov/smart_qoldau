import { Injectable } from '@nestjs/common';
import { ChatMessage, Consultation } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { isUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConsultationsService,
  ParticipantRole,
} from '../consultations/consultations.service';
import { apiError } from '../common/filters/app-exception.filter';
import { AuditService } from '../audit/audit.service';
import { MessageCipher } from './message-cipher';
import { MessageDto } from './dto/message.dto';
import { MessageHistoryDto } from './dto/message-history.dto';

const MAX_TEXT_LENGTH = 4000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type SenderRole = ParticipantRole;

export type SendMessageResult = {
  message: MessageDto;
  created: boolean;
};

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private consultations: ConsultationsService,
    private cipher: MessageCipher,
    private audit: AuditService,
  ) {}

  // Резолвер участника вынесен в ConsultationsService.resolveParticipant
  // (общий с MediaService) — тонкая обёртка для обратной совместимости
  // вызывающих внутри модуля чата.
  async resolveParticipant(
    consultationId: string,
    userSub: string,
  ): Promise<{ consultation: Consultation; role: SenderRole }> {
    return this.consultations.resolveParticipant(consultationId, userSub);
  }

  async assertLiveAccess(consultation: Consultation): Promise<void> {
    await this.consultations.assertLiveAccess(consultation);
  }

  async send(
    consultationId: string,
    senderUserId: string,
    text: string,
    clientMessageId?: string,
  ): Promise<MessageDto> {
    const resolved = await this.resolveParticipant(
      consultationId,
      senderUserId,
    );
    return (
      await this.sendResolved(
        resolved.consultation,
        resolved.role,
        senderUserId,
        text,
        clientMessageId,
      )
    ).message;
  }

  // Вариант send() для вызывающих, которые уже резолвили участника (WS
  // gateway — избегаем повторного findUnique консультации ради комнат
  // рассылки).
  async sendResolved(
    consultation: Consultation,
    role: SenderRole,
    senderUserId: string,
    text: string,
    clientMessageId?: string,
  ): Promise<SendMessageResult> {
    const trimmed = text?.trim() ?? '';
    if (trimmed.length < 1 || trimmed.length > MAX_TEXT_LENGTH) {
      apiError('VALIDATION_FAILED', 'Некорректный текст сообщения', 400);
    }
    if (clientMessageId !== undefined && !isUUID(clientMessageId, '4')) {
      apiError('VALIDATION_FAILED', 'Некорректный clientMessageId', 400);
    }

    if (clientMessageId) {
      const existing = await this.findCorrelated(
        consultation.id,
        senderUserId,
        clientMessageId,
      );
      if (existing) {
        return {
          message: this.correlatedReplay(existing, role, trimmed),
          created: false,
        };
      }
    }

    // Historical replay is resolved above. Only a genuinely new command must
    // satisfy current ACTIVE + confirmed-hold gates.
    await this.assertLiveAccess(consultation);

    const ciphertext = this.cipher.encrypt(trimmed);
    try {
      const message = await this.prisma.chatMessage.create({
        data: {
          consultationId: consultation.id,
          senderRole: role,
          senderUserId: clientMessageId ? senderUserId : null,
          clientMessageId: clientMessageId ?? null,
          // Prisma Bytes ожидает Uint8Array<ArrayBuffer>; Buffer — рантайм
          // Uint8Array-совместим, но TS-типы SharedArrayBuffer-инвариантны.
          ciphertext: ciphertext as unknown as Uint8Array<ArrayBuffer>,
        },
      });
      return { message: this.toDto(message, trimmed), created: true };
    } catch (error) {
      if (
        !clientMessageId ||
        !(error instanceof PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      const existing = await this.findCorrelated(
        consultation.id,
        senderUserId,
        clientMessageId,
      );
      if (!existing) throw error;
      return {
        message: this.correlatedReplay(existing, role, trimmed),
        created: false,
      };
    }
  }

  private findCorrelated(
    consultationId: string,
    senderUserId: string,
    clientMessageId: string,
  ): Promise<ChatMessage | null> {
    return this.prisma.chatMessage.findUnique({
      where: {
        consultationId_senderUserId_clientMessageId: {
          consultationId,
          senderUserId,
          clientMessageId,
        },
      },
    });
  }

  private correlatedReplay(
    message: ChatMessage,
    role: SenderRole,
    trimmed: string,
  ): MessageDto {
    const storedText = this.cipher.decrypt(message.ciphertext as Buffer);
    if (message.senderRole !== role || storedText !== trimmed) {
      apiError(
        'CLIENT_MESSAGE_ID_REUSED',
        'clientMessageId уже использован для другого сообщения',
        409,
      );
    }
    return this.toDto(message, storedText);
  }

  private toDto(message: ChatMessage, text: string): MessageDto {
    return {
      id: message.id,
      consultationId: message.consultationId,
      senderRole: message.senderRole as SenderRole,
      ...(message.clientMessageId
        ? { clientMessageId: message.clientMessageId }
        : {}),
      text,
      createdAt: message.createdAt,
    };
  }

  // История чата участника, порядок createdAt asc. cursor — id последнего
  // сообщения предыдущей страницы: фильтр createdAt > его createdAt OR
  // (createdAt = его createdAt AND id > его id) — устойчиво к дублям
  // createdAt (одна миллисекунда, несколько сообщений).
  async listHistory(
    consultationId: string,
    userSub: string,
    cursor: string | undefined,
    limit: number | undefined,
  ): Promise<MessageHistoryDto> {
    const { role } = await this.resolveParticipant(consultationId, userSub);

    // ТЗ §11.7: чтение переписки — самый чувствительный вид доступа к
    // консультации (сообщения возвращаются расшифрованными), журналируем
    // отдельно от чтения карточки.
    await this.audit.logAccess({
      actorType: role === 'client' ? 'user' : 'expert',
      actorId: userSub,
      entity: 'consultation',
      entityId: consultationId,
      transition: 'consultation.messages_read',
    });

    const take = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    let cursorMessage: { createdAt: Date; id: string } | null = null;
    if (cursor) {
      cursorMessage = await this.prisma.chatMessage.findUnique({
        where: { id: cursor },
        select: { createdAt: true, id: true },
      });
    }

    const rows = await this.prisma.chatMessage.findMany({
      where: {
        consultationId,
        ...(cursorMessage
          ? {
              OR: [
                { createdAt: { gt: cursorMessage.createdAt } },
                {
                  createdAt: cursorMessage.createdAt,
                  id: { gt: cursorMessage.id },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: take + 1,
    });

    const hasMore = rows.length > take;
    const page = hasMore ? rows.slice(0, take) : rows;

    return {
      items: page.map((row) => ({
        id: row.id,
        consultationId: row.consultationId,
        senderRole: row.senderRole as SenderRole,
        ...(row.clientMessageId
          ? { clientMessageId: row.clientMessageId }
          : {}),
        text: this.cipher.decrypt(row.ciphertext as Buffer),
        createdAt: row.createdAt,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }
}
