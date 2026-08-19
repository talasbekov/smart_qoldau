import { Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { CandidateResponse, Request, RequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { MatchingService } from '../matching/matching.service';
import { ExpertsService } from '../experts/experts.service';
import { apiError } from '../common/filters/app-exception.filter';
import { CreateRequestDto } from './dto/create-request.dto';
import { RequestDto } from './dto/request.dto';
import { OfferDto } from './dto/offer.dto';
import { AcceptOfferDto } from './dto/accept-offer.dto';
import {
  OFFER_TIMER_REGISTRY,
  OfferTimerRegistry,
} from './offer-timer.registry';

const EMERGENCY_DEADLINE_MS = 20_000;
const NORMAL_DEADLINE_MS = 45_000;
const HOTLINES = ['150', '103', '112'];

@Injectable()
export class RequestsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private clock: ClockService,
    private matching: MatchingService,
    private experts: ExpertsService,
    @Inject(OFFER_TIMER_REGISTRY) private offerTimer: OfferTimerRegistry,
  ) {}

  // Создание заявки. Одна активная (SEARCHING) заявка на клиента — проверка
  // через findFirst; гонка двух одновременных create одного клиента может
  // создать две активные заявки (известное ограничение, устраняется задачей
  // с уникальным частичным индексом/advisory lock — вне скоупа задачи 4).
  async create(
    clientUserId: string,
    dto: CreateRequestDto,
  ): Promise<RequestDto> {
    const active = await this.prisma.request.findFirst({
      where: { clientUserId, status: RequestStatus.SEARCHING },
    });
    if (active)
      apiError(
        'ACTIVE_REQUEST_EXISTS',
        'У клиента уже есть активная заявка',
        409,
      );

    const topic = await this.prisma.topic.findUnique({
      where: { slug: dto.topicSlug },
    });
    if (!topic) apiError('VALIDATION_FAILED', 'Неизвестный slug темы', 400);

    const isEmergency = dto.isEmergency ?? false;
    let candidateIds: string[];

    if (dto.expertId) {
      const pipeline = await this.matching.findCandidates({
        topicSlug: dto.topicSlug,
        format: dto.format,
        urgentOnly: isEmergency,
      });
      if (!pipeline.includes(dto.expertId))
        apiError(
          'EXPERT_UNAVAILABLE',
          'Выбранный эксперт сейчас недоступен',
          409,
        );
      candidateIds = [dto.expertId];
    } else {
      candidateIds = await this.matching.findCandidates({
        topicSlug: dto.topicSlug,
        format: dto.format,
        urgentOnly: isEmergency,
      });
    }

    const clientCode = randomInt(1000, 10000);
    const now = this.clock.now();

    const created = await this.prisma.request.create({
      data: {
        clientUserId,
        clientCode,
        topicId: topic.id,
        format: dto.format,
        isEmergency,
        directedExpertId: dto.expertId ?? null,
        status: RequestStatus.SEARCHING,
      },
    });

    await this.audit.log({
      actorType: 'user',
      actorId: clientUserId,
      entity: 'request',
      entityId: created.id,
      transition: 'request.created',
      payload: {
        topicSlug: dto.topicSlug,
        format: dto.format,
        isEmergency,
        directed: !!dto.expertId,
      },
    });

    if (candidateIds.length === 0) {
      const closed = await this.prisma.request.update({
        where: { id: created.id },
        data: { status: RequestStatus.NO_EXPERTS, closedAt: now },
      });
      await this.audit.log({
        actorType: 'system',
        entity: 'request',
        entityId: created.id,
        transition: 'request.no_experts',
      });
      return this.toRequestDto(closed);
    }

    await this.offerToNext(created.id);
    const fresh = await this.prisma.request.findUniqueOrThrow({
      where: { id: created.id },
    });
    return this.toRequestDto(fresh);
  }

  // Следующий по скору кандидат заявки. Исключает уже ответивших (любой
  // response для этой заявки) и экспертов с активным PENDING-оффером ЭТОЙ
  // же заявки (защита от повторной отправки). false — кандидатов нет
  // (заявка остаётся как есть — вызывающий код решает, что делать).
  async offerToNext(requestId: string): Promise<boolean> {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: { topic: true },
    });
    if (!request) return false;

    const existingCandidates = await this.prisma.requestCandidate.findMany({
      where: { requestId },
      select: { expertId: true },
    });
    const excludeExpertIds = existingCandidates.map((c) => c.expertId);

    let nextExpertId: string | undefined;

    if (request.directedExpertId) {
      // directed-заявка: единственный допустимый кандидат — выбранный
      // эксперт; повторной ротации нет.
      if (!excludeExpertIds.includes(request.directedExpertId)) {
        nextExpertId = request.directedExpertId;
      }
    } else {
      const ranked = await this.matching.findCandidates({
        topicSlug: request.topic.slug,
        format: request.format,
        excludeExpertIds,
        urgentOnly: request.isEmergency,
      });
      nextExpertId = ranked[0];
    }

    if (!nextExpertId) return false;

    const now = this.clock.now();
    const deadlineAt = new Date(
      now.getTime() +
        (request.isEmergency ? EMERGENCY_DEADLINE_MS : NORMAL_DEADLINE_MS),
    );

    const offer = await this.prisma.requestCandidate.create({
      data: {
        requestId,
        expertId: nextExpertId,
        offeredAt: now,
        deadlineAt,
        response: CandidateResponse.PENDING,
      },
    });

    await this.offerTimer.schedule(offer.id, deadlineAt);

    await this.audit.log({
      actorType: 'system',
      entity: 'offer',
      entityId: offer.id,
      transition: 'offer.sent',
      payload: { expertId: nextExpertId },
    });

    return true;
  }

  // Атомарное принятие оффера. Два шага updateMany (сначала оффер, затем
  // заявка) держат гонки безопасными без транзакции на уровне приложения —
  // выигрывает ровно один updateMany на каждом шаге.
  async claimOffer(offerId: string, expertId: string): Promise<Request> {
    const offer = await this.prisma.requestCandidate.findUnique({
      where: { id: offerId },
    });
    if (!offer || offer.expertId !== expertId)
      apiError('OFFER_NOT_FOUND', 'Оффер не найден', 404);

    const now = this.clock.now();
    const claimResult = await this.prisma.requestCandidate.updateMany({
      where: { id: offerId, response: CandidateResponse.PENDING },
      data: { response: CandidateResponse.ACCEPTED, respondedAt: now },
    });

    if (claimResult.count === 0) {
      const actual = await this.prisma.requestCandidate.findUniqueOrThrow({
        where: { id: offerId },
      });
      if (
        actual.response === CandidateResponse.TIMEOUT ||
        actual.response === CandidateResponse.REVOKED
      )
        apiError('OFFER_EXPIRED', 'Срок действия оффера истёк', 410);
      apiError('OFFER_ALREADY_TAKEN', 'Оффер уже принят', 409);
    }

    await this.offerTimer.cancel(offerId);

    const matchResult = await this.prisma.request.updateMany({
      where: { id: offer!.requestId, status: RequestStatus.SEARCHING },
      data: {
        status: RequestStatus.MATCHED,
        matchedExpertId: expertId,
        closedAt: now,
      },
    });

    if (matchResult.count === 0) {
      // Заявка уже закрыта (отменена/сматчена иначе) — откатываем оффер.
      await this.prisma.requestCandidate.update({
        where: { id: offerId },
        data: { response: CandidateResponse.REVOKED },
      });
      await this.audit.log({
        actorType: 'system',
        entity: 'offer',
        entityId: offerId,
        transition: 'offer.revoked',
      });
      apiError('OFFER_ALREADY_TAKEN', 'Оффер уже принят', 409);
    }

    await this.audit.log({
      actorType: 'expert',
      actorId: expertId,
      entity: 'offer',
      entityId: offerId,
      transition: 'offer.accepted',
    });
    await this.audit.log({
      actorType: 'system',
      entity: 'request',
      entityId: offer!.requestId,
      transition: 'request.matched',
      payload: { expertId },
    });

    await this.revokeOtherPendingOffers(offer!.requestId, offerId);

    return this.prisma.request.findUniqueOrThrow({
      where: { id: offer!.requestId },
    });
  }

  async acceptOffer(
    offerId: string,
    expertId: string,
  ): Promise<AcceptOfferDto> {
    const request = await this.claimOffer(offerId, expertId);
    return { requestId: request.id, status: request.status };
  }

  async declineOffer(offerId: string, expertId: string): Promise<void> {
    const offer = await this.prisma.requestCandidate.findUnique({
      where: { id: offerId },
    });
    if (!offer || offer.expertId !== expertId)
      apiError('OFFER_NOT_FOUND', 'Оффер не найден', 404);

    const now = this.clock.now();
    const declineResult = await this.prisma.requestCandidate.updateMany({
      where: { id: offerId, response: CandidateResponse.PENDING },
      data: { response: CandidateResponse.DECLINED, respondedAt: now },
    });
    if (declineResult.count === 0) {
      const actual = await this.prisma.requestCandidate.findUniqueOrThrow({
        where: { id: offerId },
      });
      if (
        actual.response === CandidateResponse.TIMEOUT ||
        actual.response === CandidateResponse.REVOKED
      )
        apiError('OFFER_EXPIRED', 'Срок действия оффера истёк', 410);
      apiError('OFFER_ALREADY_TAKEN', 'Оффер уже принят', 409);
    }

    await this.offerTimer.cancel(offerId);

    await this.audit.log({
      actorType: 'expert',
      actorId: expertId,
      entity: 'offer',
      entityId: offerId,
      transition: 'offer.declined',
    });

    // Некому предложить дальше — заявка остаётся SEARCHING (без закрытия в
    // NO_EXPERTS): закрытие по возрасту/эскалация делает sweep задачи 5.
    await this.offerToNext(offer!.requestId);
  }

  async cancel(requestId: string, clientUserId: string): Promise<RequestDto> {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
    });
    if (!request || request.clientUserId !== clientUserId)
      apiError('REQUEST_NOT_FOUND', 'Заявка не найдена', 404);

    if (request!.status !== RequestStatus.SEARCHING)
      apiError('REQUEST_ALREADY_CLOSED', 'Заявка уже закрыта', 409);

    const now = this.clock.now();
    const cancelResult = await this.prisma.request.updateMany({
      where: { id: requestId, status: RequestStatus.SEARCHING },
      data: { status: RequestStatus.CANCELLED, closedAt: now },
    });
    if (cancelResult.count === 0)
      apiError('REQUEST_ALREADY_CLOSED', 'Заявка уже закрыта', 409);

    await this.revokeOtherPendingOffers(requestId, null);

    await this.audit.log({
      actorType: 'user',
      actorId: clientUserId,
      entity: 'request',
      entityId: requestId,
      transition: 'request.cancelled',
    });

    const fresh = await this.prisma.request.findUniqueOrThrow({
      where: { id: requestId },
    });
    return this.toRequestDto(fresh);
  }

  async findForOwner(
    requestId: string,
    clientUserId: string,
  ): Promise<RequestDto> {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
    });
    if (!request || request.clientUserId !== clientUserId)
      apiError('REQUEST_NOT_FOUND', 'Заявка не найдена', 404);
    return this.toRequestDto(request!);
  }

  async listOffersForExpert(expertId: string): Promise<OfferDto[]> {
    const offers = await this.prisma.requestCandidate.findMany({
      where: { expertId, response: CandidateResponse.PENDING },
      include: { request: { include: { topic: true } } },
      orderBy: { offeredAt: 'asc' },
    });
    return offers.map((o) => ({
      offerId: o.id,
      topicSlug: o.request.topic.slug,
      format: o.request.format,
      isEmergency: o.request.isEmergency,
      clientCode: o.request.clientCode,
      deadlineAt: o.deadlineAt,
    }));
  }

  // Ревокирует все прочие PENDING-офферы заявки (кроме exceptOfferId, если
  // задан) и отменяет их таймеры.
  private async revokeOtherPendingOffers(
    requestId: string,
    exceptOfferId: string | null,
  ): Promise<void> {
    const pending = await this.prisma.requestCandidate.findMany({
      where: {
        requestId,
        response: CandidateResponse.PENDING,
        ...(exceptOfferId ? { id: { not: exceptOfferId } } : {}),
      },
    });
    if (pending.length === 0) return;

    await this.prisma.requestCandidate.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: { response: CandidateResponse.REVOKED },
    });

    for (const p of pending) {
      await this.offerTimer.cancel(p.id);
      await this.audit.log({
        actorType: 'system',
        entity: 'offer',
        entityId: p.id,
        transition: 'offer.revoked',
      });
    }
  }

  private async toRequestDto(request: Request): Promise<RequestDto> {
    const dto: RequestDto = {
      id: request.id,
      status: request.status,
      isEmergency: request.isEmergency,
      clientCode: request.clientCode,
    };
    if (request.status === RequestStatus.MATCHED && request.matchedExpertId) {
      dto.matchedExpert = await this.experts.findPublicById(
        request.matchedExpertId,
      );
    }
    if (request.status === RequestStatus.CALLBACK_REQUESTED) {
      dto.hotlines = HOTLINES;
    }
    return dto;
  }
}
