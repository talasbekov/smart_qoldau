import { Injectable, Logger } from '@nestjs/common';
import { Consultation, Prisma, Request, WorkStatus } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { PresenceService } from '../presence/presence.service';
import { ExpertsService } from '../experts/experts.service';
import { EventsService } from '../ws/events.service';
import { apiError } from '../common/filters/app-exception.filter';
import { ListConsultationsDto } from './dto/list-consultations.dto';
import { ConsultationClientDto } from './dto/consultation-client.dto';
import { ConsultationExpertDto } from './dto/consultation-expert.dto';

const DEFAULT_TAKE = 20;
const MAX_TAKE = 100;

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

  async findForParticipant(
    consultationId: string,
    userSub: string,
  ): Promise<ConsultationClientDto | ConsultationExpertDto> {
    const consultation = await this.prisma.consultation.findUnique({
      where: { id: consultationId },
    });
    if (!consultation)
      apiError('CONSULTATION_NOT_FOUND', 'Консультация не найдена', 404);

    if (consultation!.clientUserId === userSub) {
      return this.toClientDto(consultation!);
    }

    const expert = await this.experts.findByUserId(userSub);
    if (expert && expert.id === consultation!.expertId) {
      return this.toExpertDto(consultation!);
    }

    apiError('CONSULTATION_NOT_FOUND', 'Консультация не найдена', 404);
    throw new Error('unreachable');
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
}
