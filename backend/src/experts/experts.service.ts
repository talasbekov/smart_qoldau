import { Injectable } from '@nestjs/common';
import {
  Expert,
  ExperienceLevel,
  Prisma,
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

const PRICE_MIN = 200_000;
const PRICE_MAX = 1_500_000;

type ExpertWithTopics = Expert & { topics: { topic: { slug: string } }[] };

@Injectable()
export class ExpertsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private presence: PresenceService,
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
    await this.prisma.expert.update({
      where: { id: expert.id },
      data: { workStatus: dto.workStatus },
    });

    if (dto.workStatus === WorkStatus.ACCEPTING) {
      await this.presence.setAvailable(expert.id);
    } else {
      await this.presence.setUnavailable(expert.id);
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
      topicSlugs: expert.topics.map((t) => t.topic.slug),
      verificationStatus: expert.verificationStatus,
      workStatus: expert.workStatus,
      isBlocked: expert.isBlocked,
      acceptsUrgent: expert.acceptsUrgent,
    };
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
