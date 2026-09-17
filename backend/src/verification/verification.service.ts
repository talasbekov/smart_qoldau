import { Injectable, Logger } from '@nestjs/common';
import {
  DocumentStatus,
  Expert,
  Prisma,
  VerificationStatus,
  WorkStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { PresenceService } from '../presence/presence.service';
import { NotificationsService } from '../notifications/notifications.service';
import { apiError } from '../common/filters/app-exception.filter';
import {
  RATING_THRESHOLD_AVG,
  RATING_THRESHOLD_COUNT,
} from '../common/rating-threshold';
import { DecisionDto } from './dto/decision.dto';
import { BlockExpertDto } from './dto/block.dto';
import { QueueEntryDto } from './dto/queue.dto';
import {
  FlaggedExpertDto,
  FlaggedExpertsQueryDto,
} from './dto/flagged-experts.dto';
import { ExpertMeDto } from '../experts/dto/expert-me.dto';
import { ClockService } from '../common/clock/clock.service';
import { VerificationOperationalSignalDto } from './dto/operational-signal.dto';

const REQUIRED_DOCUMENTS_COUNT = 4;
const DEFAULT_TAKE = 20;
const MAX_TAKE = 100;
const VERIFICATION_QUEUE_THRESHOLD_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;

interface VerificationOperationalAggregate {
  overdueCount: number;
  missingSubmittedAtCount: number;
  oldestPendingSubmittedAt: Date | null;
}

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private storage: StorageService,
    private presence: PresenceService,
    private notifications: NotificationsService,
    private clock: ClockService,
  ) {}

  async operationalSignal(): Promise<VerificationOperationalSignalDto> {
    const observedAt = this.clock.now();
    const cutoff = new Date(
      observedAt.getTime() - VERIFICATION_QUEUE_THRESHOLD_HOURS * HOUR_MS,
    );

    const [aggregate] = await this.prisma.$queryRaw<
      VerificationOperationalAggregate[]
    >(Prisma.sql`
      SELECT
        COUNT(*) FILTER (
          WHERE verification_submitted_at < ${cutoff}
        )::int AS "overdueCount",
        COUNT(*) FILTER (
          WHERE verification_submitted_at IS NULL
        )::int AS "missingSubmittedAtCount",
        MIN(verification_submitted_at) FILTER (
          WHERE verification_submitted_at IS NOT NULL
        ) AS "oldestPendingSubmittedAt"
      FROM experts
      WHERE verification_status = CAST(
        ${VerificationStatus.PENDING} AS "VerificationStatus"
      )
    `);

    const oldestPendingAgeSeconds = aggregate.oldestPendingSubmittedAt
      ? Math.max(
          0,
          Math.floor(
            (observedAt.getTime() -
              aggregate.oldestPendingSubmittedAt.getTime()) /
              1000,
          ),
        )
      : null;

    return {
      signal: 'verification.queue_over_24h',
      state: aggregate.overdueCount > 0 ? 'alerting' : 'ok',
      thresholdHours: VERIFICATION_QUEUE_THRESHOLD_HOURS,
      overdueCount: aggregate.overdueCount,
      oldestPendingAgeSeconds,
      missingSubmittedAtCount: aggregate.missingSubmittedAtCount,
      observedAt: observedAt.toISOString(),
    };
  }

  async queue(): Promise<QueueEntryDto[]> {
    const experts = await this.prisma.expert.findMany({
      where: { verificationStatus: VerificationStatus.PENDING },
      include: { documents: true },
      // Очередь читается сверху вниз, поэтому первым должен идти тот, кто
      // ждёт дольше всех (SLA 24ч, ТЗ §11.4). nulls last — записи,
      // отправленные до появления verificationSubmittedAt, отметки не
      // имеют и в хвосте никому не мешают.
      orderBy: { verificationSubmittedAt: { sort: 'asc', nulls: 'last' } },
    });

    return Promise.all(
      experts.map(async (expert) => ({
        id: expert.id,
        displayName: expert.displayName,
        verificationStatus: expert.verificationStatus,
        submittedAt: expert.verificationSubmittedAt,
        documents: await Promise.all(
          expert.documents.map(async (doc) => ({
            id: doc.id,
            type: doc.type,
            status: doc.status,
            downloadUrl: await this.storage.getSignedDownloadUrl(doc.fileKey),
          })),
        ),
      })),
    );
  }

  async decideDocument(
    documentId: string,
    dto: DecisionDto,
    actorId: string,
  ): Promise<{ id: string; status: DocumentStatus }> {
    if (!dto.approve && !dto.comment)
      apiError(
        'VALIDATION_FAILED',
        'Комментарий обязателен при отклонении документа',
        400,
      );

    const doc = await this.prisma.expertDocument.findUnique({
      where: { id: documentId },
      include: { expert: true },
    });
    if (!doc) apiError('NOT_FOUND', 'Документ не найден', 404);

    const status = dto.approve
      ? DocumentStatus.APPROVED
      : DocumentStatus.REUPLOAD_REQUIRED;

    await this.prisma.$transaction(async (tx) => {
      await tx.expertDocument.update({
        where: { id: documentId },
        data: { status, comment: dto.approve ? null : dto.comment },
      });

      // Отклонение документа у эксперта в PENDING возвращает его в DRAFT,
      // иначе повторный submit невозможен (Task 4 разрешает submit только из DRAFT).
      // У VERIFIED-эксперта статус НЕ меняется (Р-18) — профиль продолжает работать.
      if (
        !dto.approve &&
        doc.expert.verificationStatus === VerificationStatus.PENDING
      ) {
        await tx.expert.update({
          where: { id: doc.expertId },
          data: { verificationStatus: VerificationStatus.DRAFT },
        });
      }
    });

    await this.audit.log({
      actorType: 'admin',
      actorId,
      entity: 'expert',
      entityId: doc.expertId,
      transition: dto.approve
        ? 'expert.document_approved'
        : 'expert.document_rejected',
      payload: { type: doc.type, comment: dto.comment ?? null },
    });

    return { id: documentId, status };
  }

  async decideExpert(
    expertId: string,
    dto: DecisionDto,
    actorId: string,
  ): Promise<ExpertMeDto> {
    if (!dto.approve && !dto.comment)
      apiError(
        'VALIDATION_FAILED',
        'Комментарий обязателен при отклонении анкеты',
        400,
      );

    const expert = await this.prisma.expert.findUnique({
      where: { id: expertId },
      include: { documents: true, topics: { include: { topic: true } } },
    });
    if (!expert) apiError('EXPERT_NOT_FOUND', 'Эксперт не найден', 404);

    if (expert.verificationStatus !== VerificationStatus.PENDING)
      apiError(
        'INVALID_STATE_TRANSITION',
        'Решение по анкете возможно только для анкет в статусе PENDING',
        400,
      );

    if (dto.approve) {
      const allApproved =
        expert.documents.length === REQUIRED_DOCUMENTS_COUNT &&
        expert.documents.every((d) => d.status === DocumentStatus.APPROVED);
      if (!allApproved)
        apiError('DOCUMENTS_INCOMPLETE', 'Не все документы одобрены', 400);
    }

    const newStatus = dto.approve
      ? VerificationStatus.VERIFIED
      : VerificationStatus.DRAFT;

    const updated = await this.prisma.expert.update({
      where: { id: expertId },
      data: { verificationStatus: newStatus },
      include: { topics: { include: { topic: true } } },
    });

    await this.audit.log({
      actorType: 'admin',
      actorId,
      entity: 'expert',
      entityId: expertId,
      transition: dto.approve
        ? 'expert.verified'
        : 'expert.verification_rejected',
      payload: dto.approve ? undefined : { comment: dto.comment },
    });

    // In-app + push (E9, задача 6): dispatch() сам никогда не бросает
    // (fire-and-forget) — сбой шины уведомлений не откатывает уже
    // зафиксированное решение.
    await this.notifications.dispatch(
      updated.userId,
      dto.approve ? 'verification.approved' : 'verification.rejected',
      { status: newStatus },
    );

    return this.toMeDto(updated);
  }

  async block(
    expertId: string,
    dto: BlockExpertDto,
    actorId: string,
  ): Promise<Expert> {
    const expert = await this.prisma.expert.findUnique({
      where: { id: expertId },
    });
    if (!expert) apiError('EXPERT_NOT_FOUND', 'Эксперт не найден', 404);

    const updated = await this.prisma.expert.update({
      where: { id: expertId },
      data: {
        isBlocked: true,
        blockedReason: dto.reason,
        workStatus: WorkStatus.NOT_ACCEPTING,
      },
    });

    // Блокировка в БД ДОЛЖНА сохраниться даже при сбое Redis: presence чистим
    // best-effort, без проброса ошибки (расхождение с presence временное).
    // Матчинг E3 обязан перепроверять isBlocked/verificationStatus из БД перед
    // диспатчем заявки — presence это подсказка доступности, не источник
    // истины о допуске.
    try {
      await this.presence.setUnavailable(expertId);
    } catch (e) {
      this.logger.error(
        `Failed to remove blocked expert ${expertId} from presence: ${
          e instanceof Error ? e.message : String(e)
        }`,
        e instanceof Error ? e.stack : '',
      );
    }

    await this.audit.log({
      actorType: 'admin',
      actorId,
      entity: 'expert',
      entityId: expertId,
      transition: 'expert.blocked',
      payload: { reason: dto.reason },
    });

    return updated;
  }

  async unblock(expertId: string, actorId: string): Promise<Expert> {
    const expert = await this.prisma.expert.findUnique({
      where: { id: expertId },
    });
    if (!expert) apiError('EXPERT_NOT_FOUND', 'Эксперт не найден', 404);

    const updated = await this.prisma.expert.update({
      where: { id: expertId },
      data: { isBlocked: false, blockedReason: null },
    });

    await this.audit.log({
      actorType: 'admin',
      actorId,
      entity: 'expert',
      entityId: expertId,
      transition: 'expert.unblocked',
    });

    return updated;
  }

  // GET /v1/admin/experts/flagged (Р-20, задача 9): эксперты с
  // ratingCount >= 20 И ratingAvg < 4.0 — та же пара условий, что
  // ReviewsService.checkRatingThreshold пишет в audit после каждого
  // пересчёта агрегатов. Сортировка по возрастанию рейтинга — худшие
  // сначала; вторичный ключ id — при равном ratingAvg у нескольких
  // экспертов порядок должен быть детерминирован между страницами (тот же
  // паттерн, что TicketsService.adminList/NotificationsService.list).
  async flaggedExperts(
    filters: FlaggedExpertsQueryDto,
  ): Promise<FlaggedExpertDto[]> {
    const take = Math.min(filters.take ?? DEFAULT_TAKE, MAX_TAKE);
    const skip = filters.skip ?? 0;

    return this.prisma.expert.findMany({
      where: {
        ratingCount: { gte: RATING_THRESHOLD_COUNT },
        ratingAvg: { lt: RATING_THRESHOLD_AVG },
      },
      orderBy: [{ ratingAvg: 'asc' }, { id: 'asc' }],
      take,
      skip,
      select: {
        id: true,
        displayName: true,
        ratingAvg: true,
        ratingCount: true,
      },
    });
  }

  private toMeDto(
    expert: Expert & { topics: { topic: { slug: string } }[] },
  ): ExpertMeDto {
    return {
      id: expert.id,
      displayName: expert.displayName,
      city: expert.city,
      experience: expert.experience,
      education: expert.education,
      priceTiyn: expert.priceTiyn,
      languages: expert.languages,
      formats: expert.formats,
      topicSlugs: expert.topics.map((t) => t.topic.slug).sort(),
      verificationStatus: expert.verificationStatus,
      workStatus: expert.workStatus,
      isBlocked: expert.isBlocked,
      acceptsUrgent: expert.acceptsUrgent,
      photoUrl: expert.photoKey
        ? this.storage.avatarUrl(expert.photoKey)
        : null,
      photoStatus: expert.photoStatus,
      about: expert.about,
      aboutStatus: expert.aboutStatus,
      moderationComment: expert.moderationComment,
    };
  }
}
