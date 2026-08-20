import { Injectable, Logger } from '@nestjs/common';
import {
  Consultation,
  ConsultationOutcome,
  ConsultationStatus,
  Prisma,
  Request,
  WorkStatus,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { PresenceService } from '../presence/presence.service';
import { ExpertsService } from '../experts/experts.service';
import { EventsService } from '../ws/events.service';
import { RedisService } from '../redis/redis.service';
import { MessageCipher } from '../chat/message-cipher';
import { apiError } from '../common/filters/app-exception.filter';
import { ListConsultationsDto } from './dto/list-consultations.dto';
import { ConsultationClientDto } from './dto/consultation-client.dto';
import { ConsultationExpertDto } from './dto/consultation-expert.dto';
import { ExpertNoteDto } from './dto/expert-note.dto';

const ABUSE_CLIENT_TTL_SECONDS = 30 * 24 * 3600;

const DEFAULT_TAKE = 20;
const MAX_TAKE = 100;

export type ParticipantRole = 'client' | 'expert';

@Injectable()
export class ConsultationsService {
  private readonly logger = new Logger(ConsultationsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private clock: ClockService,
    private presence: PresenceService,
    private experts: ExpertsService,
    private events: EventsService,
    private redis: RedisService,
    private cipher: MessageCipher,
  ) {}

  // Вызывается из RequestsService.claimOffer ВНУТРИ транзакции матча (tx),
  // атомарно с переходами оффера PENDING->ACCEPTED и заявки
  // SEARCHING->MATCHED — сбой создания консультации откатывает весь матч
  // (заявка остаётся SEARCHING, оффер PENDING — повторный accept возможен).
  // requestId уникален (@unique) -> P2002 = конкурентный/повторный вызов —
  // идемпотентно возвращаем уже созданную запись, а не падаем.
  // ТОЛЬКО запись в БД: сайд-эффекты (BUSY, аудит, WS) — в
  // applyMatchSideEffects, вызываемой ПОСЛЕ коммита транзакции.
  async createFromMatch(
    request: Request,
    expertId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Consultation> {
    const db = tx ?? this.prisma;
    const expert = await db.expert.findUniqueOrThrow({
      where: { id: expertId },
    });
    const now = this.clock.now();

    try {
      return await db.consultation.create({
        data: {
          requestId: request.id,
          clientUserId: request.clientUserId,
          clientCode: request.clientCode,
          expertId,
          topicId: request.topicId,
          format: request.format,
          isEmergency: request.isEmergency,
          priceTiyn: expert.priceTiyn,
          startedAt: now,
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await db.consultation.findUnique({
          where: { requestId: request.id },
        });
        if (existing) return existing;
      }
      throw e;
    }
  }

  // Сайд-эффекты матча — ПОСЛЕ коммита транзакции (best-effort относительно
  // уже созданной консультации): авто-BUSY эксперта (Р-13), audit
  // consultation.created, WS эксперту. Сбой BUSY при существующей
  // консультации — приемлемое частичное состояние (эксперт увидит
  // консультацию в своём списке).
  async applyMatchSideEffects(consultation: Consultation): Promise<void> {
    await this.audit.log({
      actorType: 'system',
      entity: 'consultation',
      entityId: consultation.id,
      transition: 'consultation.created',
      payload: {
        requestId: consultation.requestId,
        expertId: consultation.expertId,
      },
    });

    await this.setExpertBusy(consultation.expertId);

    const topic = await this.prisma.topic.findUniqueOrThrow({
      where: { id: consultation.topicId },
    });
    this.events.emitToExpert(consultation.expertId, 'consultation.created', {
      consultationId: consultation.id,
      clientCode: consultation.clientCode,
      topicSlug: topic.slug,
      format: consultation.format,
    });
  }

  // Системный переход эксперта в BUSY (не self-set, поэтому не
  // ExpertsService.updateWorkStatus — тот сделан под self-service со своими
  // проверками isBlocked/verificationStatus). Паттерн компенсации —
  // как в ExpertsService.updateWorkStatus (E2 Task 6): presence сначала,
  // БД потом; БД упала -> компенсация обратно в presence ТОЛЬКО если эксперт
  // был ACCEPTING (иначе он и так не был доступен — компенсировать нечего).
  private async setExpertBusy(expertId: string): Promise<void> {
    const expert = await this.prisma.expert.findUniqueOrThrow({
      where: { id: expertId },
    });
    const from = expert.workStatus;

    await this.presence.setUnavailable(expertId);

    try {
      await this.prisma.expert.update({
        where: { id: expertId },
        data: { workStatus: WorkStatus.BUSY },
      });
    } catch (e) {
      try {
        if (from === WorkStatus.ACCEPTING) {
          await this.presence.setAvailable(expertId);
        }
      } catch (compensationError) {
        this.logger.error(
          `Failed to compensate presence for expert ${expertId}: ${
            compensationError instanceof Error
              ? compensationError.message
              : String(compensationError)
          }`,
          compensationError instanceof Error
            ? compensationError.stack
            : undefined,
        );
      }
      throw e;
    }

    await this.audit.log({
      actorType: 'system',
      entity: 'expert',
      entityId: expertId,
      transition: 'expert.work_status_changed',
      payload: { from, to: WorkStatus.BUSY },
    });
  }

  // Эксперт завершает консультацию (роль зафиксирована контроллером через
  // resolveParticipant). Только ACTIVE -> иначе 409 CONSULTATION_NOT_ACTIVE;
  // атомарный updateMany {id, status: ACTIVE} защищает от гонки с
  // parallel cancel() клиента — ровно один из двух переходов побеждает.
  async complete(
    consultationId: string,
    userSub: string,
    outcome: ConsultationOutcome,
  ): Promise<ConsultationExpertDto> {
    const { consultation, role } = await this.resolveParticipant(
      consultationId,
      userSub,
    );
    if (role !== 'expert')
      apiError('FORBIDDEN', 'Только эксперт может завершить консультацию', 403);

    const now = this.clock.now();
    const result = await this.prisma.consultation.updateMany({
      where: { id: consultationId, status: ConsultationStatus.ACTIVE },
      data: { status: ConsultationStatus.COMPLETED, outcome, endedAt: now },
    });
    if (result.count === 0)
      apiError(
        'CONSULTATION_NOT_ACTIVE',
        'Консультация уже завершена или отменена',
        409,
      );

    const durationMin = Math.round(
      (now.getTime() - consultation.startedAt.getTime()) / 60000,
    );

    await this.returnExpertToAccepting(consultation.expertId);

    await this.audit.log({
      actorType: 'expert',
      actorId: consultation.expertId,
      entity: 'consultation',
      entityId: consultationId,
      transition: 'consultation.completed',
      payload: { outcome, durationMin },
    });

    this.emitConsultationUpdated(
      consultation,
      ConsultationStatus.COMPLETED,
      outcome,
    );

    const updated = await this.prisma.consultation.findUniqueOrThrow({
      where: { id: consultationId },
    });
    return this.toExpertDto(updated);
  }

  // Клиент отменяет консультацию. Только ACTIVE -> 409 иначе; атомарный
  // updateMany на защиту от гонки с complete() эксперта. Redis-счётчик
  // злоупотреблений: INCR (создаёт ключ при первом вызове) + EXPIRE только
  // если TTL ещё не установлен (ttl === -1) — идемпотентно относительно
  // повторных отмен того же клиента внутри окна.
  async cancel(
    consultationId: string,
    userSub: string,
  ): Promise<ConsultationClientDto> {
    const { consultation, role } = await this.resolveParticipant(
      consultationId,
      userSub,
    );
    if (role !== 'client')
      apiError('FORBIDDEN', 'Только клиент может отменить консультацию', 403);

    const now = this.clock.now();
    const result = await this.prisma.consultation.updateMany({
      where: { id: consultationId, status: ConsultationStatus.ACTIVE },
      data: {
        status: ConsultationStatus.CANCELLED,
        outcome: ConsultationOutcome.CLIENT_CANCELLED,
        endedAt: now,
      },
    });
    if (result.count === 0)
      apiError(
        'CONSULTATION_NOT_ACTIVE',
        'Консультация уже завершена или отменена',
        409,
      );

    const abuseKey = `abuse:client:${userSub}`;
    const count = await this.redis.incr(abuseKey);
    if (count === 1) {
      await this.redis.expire(abuseKey, ABUSE_CLIENT_TTL_SECONDS);
    } else {
      const ttl = await this.redis.ttl(abuseKey);
      if (ttl === -1)
        await this.redis.expire(abuseKey, ABUSE_CLIENT_TTL_SECONDS);
    }

    await this.returnExpertToAccepting(consultation.expertId);

    await this.audit.log({
      actorType: 'user',
      actorId: userSub,
      entity: 'consultation',
      entityId: consultationId,
      transition: 'consultation.cancelled_by_client',
    });

    this.emitConsultationUpdated(
      consultation,
      ConsultationStatus.CANCELLED,
      ConsultationOutcome.CLIENT_CANCELLED,
    );

    const updated = await this.prisma.consultation.findUniqueOrThrow({
      where: { id: consultationId },
    });
    return this.toClientDto(updated);
  }

  // Паттерн компенсации: эксперт возвращается ACCEPTING+presence, ТОЛЬКО
  // если он всё ещё BUSY (не сменил статус сам/не заблокирован в промежутке
  // — в этих случаях его состояние трогать нельзя, оно уже managed кем-то
  // другим). Presence сначала, БД потом — при сбое БД компенсация обратно.
  private async returnExpertToAccepting(expertId: string): Promise<void> {
    const expert = await this.prisma.expert.findUnique({
      where: { id: expertId },
    });
    if (!expert || expert.workStatus !== WorkStatus.BUSY) return;

    await this.presence.setAvailable(expertId);
    try {
      await this.prisma.expert.update({
        where: { id: expertId },
        data: { workStatus: WorkStatus.ACCEPTING },
      });
    } catch (e) {
      try {
        await this.presence.setUnavailable(expertId);
      } catch (compensationError) {
        this.logger.error(
          `Failed to compensate presence for expert ${expertId}: ${
            compensationError instanceof Error
              ? compensationError.message
              : String(compensationError)
          }`,
          compensationError instanceof Error
            ? compensationError.stack
            : undefined,
        );
      }
      throw e;
    }

    await this.audit.log({
      actorType: 'system',
      entity: 'expert',
      entityId: expertId,
      transition: 'expert.work_status_changed',
      payload: { from: WorkStatus.BUSY, to: WorkStatus.ACCEPTING },
    });
  }

  private emitConsultationUpdated(
    consultation: Consultation,
    status: ConsultationStatus,
    outcome: ConsultationOutcome,
  ): void {
    const payload = { id: consultation.id, status, outcome };
    this.events.emitToUser(
      consultation.clientUserId,
      'consultation.updated',
      payload,
    );
    this.events.emitToExpert(
      consultation.expertId,
      'consultation.updated',
      payload,
    );
  }

  // Резолвит участие пользователя в консультации: клиент по clientUserId,
  // либо эксперт через ExpertsService.findByUserId -> expertId. Не
  // участник/не найдена -> CONSULTATION_NOT_FOUND 404 (не раскрываем
  // существование чужой консультации). Общий резолвер эпика — используется
  // ConsultationsService, ChatService и MediaService.
  async resolveParticipant(
    consultationId: string,
    userSub: string,
  ): Promise<{ consultation: Consultation; role: ParticipantRole }> {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
    });
    if (!consultation) {
      apiError('CONSULTATION_NOT_FOUND', 'Консультация не найдена', 404);
    }

    if (consultation!.clientUserId === userSub) {
      return { consultation: consultation!, role: 'client' };
    }

    const expert = await this.experts.findByUserId(userSub);
    if (expert && expert.id === consultation!.expertId) {
      return { consultation: consultation!, role: 'expert' };
    }

    apiError('CONSULTATION_NOT_FOUND', 'Консультация не найдена', 404);
    throw new Error('unreachable');
  }

  async findForParticipant(
    consultationId: string,
    userSub: string,
  ): Promise<ConsultationClientDto | ConsultationExpertDto> {
    const { consultation, role } = await this.resolveParticipant(
      consultationId,
      userSub,
    );
    return role === 'client'
      ? this.toClientDto(consultation)
      : this.toExpertDto(consultation);
  }

  async listForUser(
    userSub: string,
    filters: ListConsultationsDto,
  ): Promise<(ConsultationClientDto | ConsultationExpertDto)[]> {
    const take = Math.min(filters.take ?? DEFAULT_TAKE, MAX_TAKE);
    const skip = filters.skip ?? 0;
    const asExpert = filters.as === 'expert';

    if (asExpert) {
      const expert = await this.experts.findByUserId(userSub);
      if (!expert) return [];
      const consultations = await this.prisma.consultation.findMany({
        where: {
          expertId: expert.id,
          ...(filters.status ? { status: filters.status } : {}),
        },
        orderBy: { startedAt: 'desc' },
        take,
        skip,
      });
      return Promise.all(consultations.map((c) => this.toExpertDto(c)));
    }

    const consultations = await this.prisma.consultation.findMany({
      where: {
        clientUserId: userSub,
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take,
      skip,
    });
    return Promise.all(consultations.map((c) => this.toClientDto(c)));
  }

  // Явная сборка — PII-инвариант: клиенту эксперт только через
  // ExpertPublicDto (без userId/phone), никакого clientCode/topicSlug
  // (клиенту эта информация не нужна — своя же заявка).
  private async toClientDto(
    consultation: Consultation,
  ): Promise<ConsultationClientDto> {
    const expert = await this.prisma.expert.findUniqueOrThrow({
      where: { id: consultation.expertId },
      include: { topics: { include: { topic: true } } },
    });
    return {
      id: consultation.id,
      status: consultation.status,
      outcome: consultation.outcome,
      format: consultation.format,
      isEmergency: consultation.isEmergency,
      startedAt: consultation.startedAt,
      endedAt: consultation.endedAt,
      priceTiyn: consultation.priceTiyn,
      plannedDurationMin: consultation.plannedDurationMin,
      expert: this.experts.toPublicDto(expert),
    };
  }

  // Явная сборка — PII-инвариант: эксперту НИКАКОГО userId/phone клиента,
  // только clientCode (как в OfferDto/RequestDto).
  private async toExpertDto(
    consultation: Consultation,
  ): Promise<ConsultationExpertDto> {
    const topic = await this.prisma.topic.findUniqueOrThrow({
      where: { id: consultation.topicId },
    });
    return {
      id: consultation.id,
      status: consultation.status,
      outcome: consultation.outcome,
      format: consultation.format,
      isEmergency: consultation.isEmergency,
      startedAt: consultation.startedAt,
      endedAt: consultation.endedAt,
      clientCode: consultation.clientCode,
      topicSlug: topic.slug,
      priceTiyn: consultation.priceTiyn,
      plannedDurationMin: consultation.plannedDurationMin,
    };
  }

  // GET приватной заметки эксперта. Только эксперт-участник (клиент → 404).
  // Возвращает {text: null} если заметки нет.
  async getExpertNote(
    consultationId: string,
    userSub: string,
  ): Promise<ExpertNoteDto> {
    // resolveParticipant гарантирует что это участник (иначе 404).
    // Для клиента это тоже вернёт 404 — заметка приватна.
    const { consultation, role } = await this.resolveParticipant(
      consultationId,
      userSub,
    );

    if (role !== 'expert') {
      apiError('CONSULTATION_NOT_FOUND', 'Консультация не найдена', 404);
    }

    const note = await this.prisma.expertNote.findUnique({
      where: { consultationId: consultation.id },
    });

    if (!note) {
      return { text: null };
    }

    // Prisma возвращает Uint8Array; кастируем в Buffer для MessageCipher
    const plaintext = this.cipher.decrypt(note.ciphertext as Buffer);
    return {
      text: plaintext,
      updatedAt: note.updatedAt.toISOString(),
    };
  }

  // PUT (upsert) приватной заметки эксперта. Только эксперт-участник.
  // text должен быть 1..5000 символов после trim.
  async updateExpertNote(
    consultationId: string,
    userSub: string,
    text: string,
  ): Promise<ExpertNoteDto> {
    // resolveParticipant гарантирует что это участник (иначе 404).
    const { consultation, role } = await this.resolveParticipant(
      consultationId,
      userSub,
    );

    if (role !== 'expert') {
      apiError('CONSULTATION_NOT_FOUND', 'Консультация не найдена', 404);
    }

    const trimmed = text.trim();

    // Валидация длины (уже проверена в DTO, но дополнительная подстраховка)
    if (trimmed.length === 0 || trimmed.length > 5000) {
      apiError(
        'INVALID_NOTE_TEXT',
        'Текст не может быть пустым или >5000 символов',
        400,
      );
    }

    const encrypted = this.cipher.encrypt(trimmed);

    // Prisma Bytes ожидает Uint8Array<ArrayBuffer>; Buffer — рантайм
    // Uint8Array-совместим, но TS-типы SharedArrayBuffer-инвариантны.
    const ciphertextBytes = encrypted as unknown as Uint8Array<ArrayBuffer>;

    const note = await this.prisma.expertNote.upsert({
      where: { consultationId: consultation.id },
      update: {
        ciphertext: ciphertextBytes,
      },
      create: {
        consultationId: consultation.id,
        expertId: consultation.expertId,
        ciphertext: ciphertextBytes,
      },
    });

    // Audit: консультация.note_updated БЕЗ содержимого
    await this.audit.log({
      actorType: 'expert',
      actorId: consultation.expertId,
      entity: 'consultation',
      entityId: consultation.id,
      transition: 'consultation.note_updated',
      payload: {
        // БЕЗ текста — это приватная информация
      },
    });

    return {
      text: trimmed,
      updatedAt: note.updatedAt.toISOString(),
    };
  }
}
