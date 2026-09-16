import { Injectable, Logger } from '@nestjs/common';
import {
  ConsultationStatus,
  Expert,
  ExperienceLevel,
  Prisma,
  ProfileFieldStatus,
  VerificationStatus,
  WorkStatus,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PresenceService } from '../presence/presence.service';
import { apiError } from '../common/filters/app-exception.filter';
import { CreateExpertDto } from './dto/create-expert.dto';
import { UpdateExpertDto } from './dto/update-expert.dto';
import { WorkStatusDto } from './dto/work-status.dto';
import { ExpertMeDto } from './dto/expert-me.dto';
import { StorageService } from '../storage/storage.service';
import { ProfileModerationService } from './profile-moderation.service';
import { ExpertPublicDto } from './dto/expert-public.dto';
import { ListExpertsDto } from './dto/list-experts.dto';

const PRICE_MIN = 200_000;
const PRICE_MAX = 1_500_000;
const ABOUT_MIN = 10;
const ABOUT_MAX = 1000;

type ExpertWithTopics = Expert & { topics: { topic: { slug: string } }[] };

@Injectable()
export class ExpertsService {
  private readonly logger = new Logger(ExpertsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private presence: PresenceService,
    private storage: StorageService,
    private moderation: ProfileModerationService,
  ) {}

  async findByUserId(userId: string): Promise<ExpertWithTopics | null> {
    return this.prisma.expert.findUnique({
      where: { userId },
      include: { topics: { include: { topic: true } } },
    });
  }

  async create(
    userId: string,
    isGuest: boolean,
    dto: CreateExpertDto,
  ): Promise<ExpertWithTopics> {
    if (isGuest)
      apiError(
        'FORBIDDEN',
        'Гостевой аккаунт не может создать анкету эксперта',
        403,
      );

    this.checkPrice(dto.priceTiyn);
    const topicIds = await this.resolveTopicIds(dto.topicSlugs);

    let expert: Expert;
    try {
      expert = await this.prisma.$transaction(async (tx) => {
        const created = await tx.expert.create({
          data: {
            userId,
            displayName: dto.displayName,
            city: dto.city,
            experience: dto.experience as ExperienceLevel,
            education: dto.education,
            priceTiyn: dto.priceTiyn,
            languages: dto.languages,
            formats: dto.formats,
          },
        });
        await tx.expertTopic.createMany({
          data: topicIds.map((topicId) => ({ expertId: created.id, topicId })),
        });
        return created;
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002')
        apiError('EXPERT_EXISTS', 'Анкета эксперта уже существует', 409);
      throw e;
    }

    await this.audit.log({
      actorType: 'user',
      actorId: userId,
      entity: 'expert',
      entityId: expert.id,
      transition: 'expert.profile_created',
    });

    const withTopics = await this.findByUserId(userId);
    return withTopics!;
  }

  async update(
    expert: Expert,
    dto: UpdateExpertDto,
  ): Promise<ExpertWithTopics> {
    if (dto.priceTiyn !== undefined) this.checkPrice(dto.priceTiyn);

    const topicIds =
      dto.topicSlugs !== undefined
        ? await this.resolveTopicIds(dto.topicSlugs)
        : undefined;

    const data: Prisma.ExpertUpdateInput = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.education !== undefined) data.education = dto.education;
    if (dto.experience !== undefined)
      data.experience = dto.experience as ExperienceLevel;
    if (dto.priceTiyn !== undefined) data.priceTiyn = dto.priceTiyn;
    if (dto.formats !== undefined) data.formats = dto.formats;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.languages !== undefined) data.languages = dto.languages;
    if (dto.about !== undefined) Object.assign(data, this.aboutData(dto.about));

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.expert.update({ where: { id: expert.id }, data });
      }
      if (topicIds !== undefined) {
        await tx.expertTopic.deleteMany({ where: { expertId: expert.id } });
        await tx.expertTopic.createMany({
          data: topicIds.map((topicId) => ({ expertId: expert.id, topicId })),
        });
      }
    });

    await this.audit.log({
      actorType: 'expert',
      actorId: expert.id,
      entity: 'expert',
      entityId: expert.id,
      transition: 'expert.profile_updated',
      payload: dto as object,
    });

    const withTopics = await this.findByUserId(expert.userId);
    return withTopics!;
  }

  // Рабочий статус эксперта + presence в Redis (задел матчинга E3).
  // Заблокирован -> EXPERT_BLOCKED 403; ACCEPTING без VERIFIED -> NOT_VERIFIED 400.
  async updateWorkStatus(
    expert: Expert,
    dto: WorkStatusDto,
  ): Promise<ExpertWithTopics> {
    if (expert.isBlocked)
      apiError('EXPERT_BLOCKED', 'Эксперт заблокирован', 403);

    if (
      dto.workStatus === WorkStatus.ACCEPTING &&
      expert.verificationStatus !== VerificationStatus.VERIFIED
    )
      apiError(
        'NOT_VERIFIED',
        'Только верифицированный эксперт может принимать заявки',
        400,
      );

    const from = expert.workStatus;
    const becomesAvailable = dto.workStatus === WorkStatus.ACCEPTING;

    // Порядок: сначала Redis (presence), затем БД. Redis упал — ничего не
    // изменилось (чистый 500). БД упала после Redis — компенсирующая обратная
    // presence-операция (best-effort) и проброс исходной ошибки.
    if (becomesAvailable) {
      await this.presence.setAvailable(expert.id);
    } else {
      await this.presence.setUnavailable(expert.id);
    }

    let updated: number;
    try {
      // The target-row CAS is rechecked by PostgreSQL against the newest row
      // version after a concurrent UPDATE. Therefore a committed BUSY cannot
      // be overwritten even when NOT EXISTS belongs to an older statement
      // snapshot. If this update wins first, activation writes BUSY after it.
      updated = await this.prisma.$executeRaw`
        UPDATE "experts"
        SET "work_status" = CAST(${dto.workStatus} AS "WorkStatus")
        WHERE "id" = ${expert.id}
          AND "work_status" <> CAST(${WorkStatus.BUSY} AS "WorkStatus")
          AND NOT EXISTS (
            SELECT 1
            FROM "consultations"
            WHERE "expert_id" = ${expert.id}
              AND "status" = CAST(${ConsultationStatus.ACTIVE} AS "ConsultationStatus")
          )
      `;
    } catch (e) {
      try {
        if (becomesAvailable) {
          await this.presence.setUnavailable(expert.id);
        } else if (from === WorkStatus.ACCEPTING) {
          await this.presence.setAvailable(expert.id);
        }
      } catch (compensationError) {
        this.logger.error(
          `Failed to compensate presence for expert ${expert.id}: ${
            compensationError instanceof Error
              ? compensationError.message
              : String(compensationError)
          }`,
          compensationError instanceof Error ? compensationError.stack : '',
        );
      }
      throw e;
    }

    if (updated === 0) {
      // ACTIVE means the expert must not be discoverable, regardless of the
      // stale status supplied by the browser that lost the race.
      try {
        await this.presence.setUnavailable(expert.id);
      } catch (presenceError) {
        this.logger.error(
          `Failed to enforce unavailable presence for busy expert ${expert.id}: ${
            presenceError instanceof Error
              ? presenceError.message
              : String(presenceError)
          }`,
          presenceError instanceof Error ? presenceError.stack : '',
        );
      }
      apiError(
        'EXPERT_BUSY',
        'Нельзя менять рабочий статус во время активной консультации',
        409,
      );
    }

    await this.audit.log({
      actorType: 'expert',
      actorId: expert.id,
      entity: 'expert',
      entityId: expert.id,
      transition: 'expert.work_status_changed',
      payload: { from, to: dto.workStatus },
    });

    const withTopics = await this.findByUserId(expert.userId);
    return withTopics!;
  }

  // Публичный список: только VERIFIED и не заблокированные. Фильтры
  // опциональны (topic/language/format), сортировка по цене опциональна.
  async listPublic(filters: ListExpertsDto): Promise<ExpertPublicDto[]> {
    const where: Prisma.ExpertWhereInput = {
      verificationStatus: VerificationStatus.VERIFIED,
      isBlocked: false,
    };
    if (filters.topic)
      where.topics = { some: { topic: { slug: filters.topic } } };
    if (filters.language) where.languages = { has: filters.language };
    if (filters.format) where.formats = { has: filters.format };

    // Вторичный ключ `id` обязателен в КАЖДОМ варианте сортировки: без
    // него две страницы с равной ценой (или равным рейтингом) могут
    // содержать одного эксперта дважды и потерять другого — порядок между
    // запросами не гарантирован (тот же дефект ловили ревью E9 и E8a).
    const orderBy: Prisma.ExpertOrderByWithRelationInput[] =
      filters.sort === 'price_asc'
        ? [{ priceTiyn: 'asc' }, { id: 'asc' }]
        : filters.sort === 'price_desc'
          ? [{ priceTiyn: 'desc' }, { id: 'asc' }]
          : filters.sort === 'rating'
            ? [{ ratingAvg: 'desc' }, { priceTiyn: 'asc' }, { id: 'asc' }]
            : [{ id: 'asc' }];

    const experts = await this.prisma.expert.findMany({
      where,
      orderBy,
      take: filters.take ?? 20,
      skip: filters.skip ?? 0,
      include: { topics: { include: { topic: true } } },
    });
    return experts.map((e) => this.toPublicDto(e));
  }

  // 404 EXPERT_NOT_FOUND для DRAFT/PENDING/blocked/несуществующего —
  // причина не раскрывается.
  async findPublicById(id: string): Promise<ExpertPublicDto> {
    const expert = await this.prisma.expert.findUnique({
      where: { id },
      include: { topics: { include: { topic: true } } },
    });
    if (
      !expert ||
      expert.verificationStatus !== VerificationStatus.VERIFIED ||
      expert.isBlocked
    )
      apiError('EXPERT_NOT_FOUND', 'Эксперт не найден', 404);
    return this.toPublicDto(expert);
  }

  toMeDto(expert: ExpertWithTopics): ExpertMeDto {
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
      // Владельцу отдаётся опубликованное значение: пока новое проверяется,
      // в профиле продолжает работать прежнее.
      photoUrl: expert.photoKey
        ? this.storage.avatarUrl(expert.photoKey)
        : null,
      photoStatus: expert.photoStatus,
      about: expert.about,
      aboutStatus: expert.aboutStatus,
      moderationComment: expert.moderationComment,
    };
  }

  // Эталон PII-инварианта: сборка ТОЛЬКО явным перечислением полей — без
  // spread модели, без userId/phone/documents/education/verificationStatus.
  toPublicDto(expert: ExpertWithTopics): ExpertPublicDto {
    return {
      id: expert.id,
      displayName: expert.displayName,
      city: expert.city,
      experience: expert.experience,
      priceTiyn: expert.priceTiyn,
      languages: expert.languages,
      formats: expert.formats,
      topicSlugs: expert.topics.map((t) => t.topic.slug).sort(),
      workStatus: expert.workStatus,
      ratingAvg: expert.ratingAvg,
      ratingCount: expert.ratingCount,
      // Наружу — только одобренное. PENDING и REJECTED не видны никогда, и
      // ключи проверяемых значений тоже: они служебные.
      photoUrl:
        expert.photoStatus === ProfileFieldStatus.APPROVED && expert.photoKey
          ? this.storage.avatarUrl(expert.photoKey)
          : null,
      about:
        expert.aboutStatus === ProfileFieldStatus.APPROVED
          ? expert.about
          : null,
    };
  }

  // «О себе» либо снимается целиком, либо уходит на проверку. Границы
  // 10–1000 символов считаются после trim: текст из одних пробелов — это
  // не текст, а его отсутствие с другим видом.
  private aboutData(raw: string): Prisma.ExpertUpdateInput {
    // Пустая строка — намеренное «снять текст». Строка из одних пробелов
    // выглядит как текст, но им не является: это ошибка ввода, и молча
    // снимать по ней опубликованный текст нельзя.
    if (raw === '') return this.moderation.clearAboutData();
    const value = raw.trim();
    if (value.length < ABOUT_MIN || value.length > ABOUT_MAX) {
      apiError(
        'VALIDATION_FAILED',
        `Текст «о себе» — от ${ABOUT_MIN} до ${ABOUT_MAX} символов`,
        400,
      );
    }
    return this.moderation.submitAboutData(value);
  }

  private checkPrice(priceTiyn: number): void {
    if (priceTiyn < PRICE_MIN || priceTiyn > PRICE_MAX)
      apiError(
        'PRICE_OUT_OF_RANGE',
        `Цена должна быть в диапазоне ${PRICE_MIN}-${PRICE_MAX} тиын`,
        400,
      );
  }

  private async resolveTopicIds(slugs: string[]): Promise<string[]> {
    const topics = await this.prisma.topic.findMany({
      where: { slug: { in: slugs } },
    });
    if (topics.length !== new Set(slugs).size)
      apiError('VALIDATION_FAILED', 'Неизвестный slug темы', 400);
    return topics.map((t) => t.id);
  }
}
