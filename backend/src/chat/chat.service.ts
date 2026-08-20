import { Injectable } from '@nestjs/common';
import { Consultation, ConsultationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConsultationsService,
  ParticipantRole,
} from '../consultations/consultations.service';
import { apiError } from '../common/filters/app-exception.filter';
import { MessageCipher } from './message-cipher';
import { MessageDto } from './dto/message.dto';
import { MessageHistoryDto } from './dto/message-history.dto';

const MAX_TEXT_LENGTH = 4000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export type SenderRole = ParticipantRole;

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private consultations: ConsultationsService,
    private cipher: MessageCipher,
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

  async send(
    consultationId: string,
    senderUserId: string,
    text: string,
  ): Promise<MessageDto> {
    const resolved = await this.resolveParticipant(
      consultationId,
      senderUserId,
    );
    return this.sendResolved(resolved.consultation, resolved.role, text);
  }

  // Вариант send() для вызывающих, которые уже резолвили участника (WS
  // gateway — избегаем повторного findUnique консультации ради комнат
  // рассылки).
  async sendResolved(
    consultation: Consultation,
    role: SenderRole,
    text: string,
  ): Promise<MessageDto> {
    if (consultation.status !== ConsultationStatus.ACTIVE) {
      apiError('CONSULTATION_NOT_ACTIVE', 'Консультация не активна', 409);
    }

    const trimmed = text?.trim() ?? '';
    if (trimmed.length < 1 || trimmed.length > MAX_TEXT_LENGTH) {
      apiError('VALIDATION_FAILED', 'Некорректный текст сообщения', 400);
    }

    const ciphertext = this.cipher.encrypt(trimmed);
    const message = await this.prisma.chatMessage.create({
      data: {
        consultationId: consultation.id,
        senderRole: role,
        // Prisma Bytes ожидает Uint8Array<ArrayBuffer>; Buffer — рантайм
        // Uint8Array-совместим, но TS-типы SharedArrayBuffer-инвариантны.
        ciphertext: ciphertext as unknown as Uint8Array<ArrayBuffer>,
      },
    });

    return {
      id: message.id,
      consultationId: message.consultationId,
      senderRole: role,
      text: trimmed,
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
    await this.resolveParticipant(consultationId, userSub);

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
        text: this.cipher.decrypt(row.ciphertext as Buffer),
        createdAt: row.createdAt,
      })),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }
}
