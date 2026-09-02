import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import {
  CandidateResponse,
  Consultation,
  Request,
  RequestStatus,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { RedisService } from '../redis/redis.service';
import { MatchingService } from '../matching/matching.service';
import { ExpertsService } from '../experts/experts.service';
import { EventsService } from '../ws/events.service';
import {
  ConsultationsService,
  ConsultationSlotTakenError,
} from '../consultations/consultations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PremiumService } from '../premium/premium.service';
import { apiError } from '../common/filters/app-exception.filter';
import { needsExpertVisibilityConsent } from '../account/consent';
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
// Р-01/Р-17: с этого числа отмен/no-show за 30 дней (счётчик abuse:client:*
// ведёт ConsultationsService) автоподбор закрыт — только ручной выбор.
const ABUSE_AUTO_MATCH_THRESHOLD = 3;

// Маркерные ошибки транзакции claimOffer: проигравший count-гейт внутри
// $transaction сигналит откат, снаружи мапится в прежние коды 409/410.
class OfferClaimLostError extends Error {}
class RequestNotSearchingError extends Error {}

@Injectable()
export class RequestsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private clock: ClockService,
    private redis: RedisService,
    private matching: MatchingService,
    private experts: ExpertsService,
    private events: EventsService,
    private consultations: ConsultationsService,
    private notifications: NotificationsService,
    @Inject(forwardRef(() => OFFER_TIMER_REGISTRY))
    private offerTimer: OfferTimerRegistry,
    private premium: PremiumService,
  ) {}

  // Создание заявки. Одна активная (SEARCHING) заявка на клиента — проверка
  // через findFirst; гонка двух одновременных create одного клиента может
  // создать две активные заявки (известное ограничение, устраняется задачей
  // с уникальным частичным индексом/advisory lock — вне скоупа задачи 4).
  async create(
    clientUserId: string,
    dto: CreateRequestDto,
  ): Promise<RequestDto> {
    // Р-27: психолог увидит имя и историю встреч, поэтому человек должен
    // об этом узнать и согласиться — ОДИН раз, перед первой заявкой.
    // Проверка стоит здесь, а не в интерфейсе: обойти экран согласия,
    // дёрнув API напрямую, не должно быть можно.
    const client = await this.prisma.user.findUnique({
      where: { id: clientUserId },
      select: { expertVisibilityAcceptedAt: true },
    });
    if (client && needsExpertVisibilityConsent(client)) {
      apiError(
        'EXPERT_VISIBILITY_CONSENT_REQUIRED',
        'Нужно согласие: психолог увидит ваше имя и историю встреч',
        409,
      );
    }

    // Abuse-гейт (Р-01/Р-17) ПЕРЕД созданием: автоподбор закрыт после 3+
    // отмен/no-show за 30 дней; направленная заявка (expertId задан —
    // ручной выбор из каталога) проходит всегда.
    if (!dto.expertId) {
      const abuseCount = Number(
        (await this.redis.get(`abuse:client:${clientUserId}`)) ?? 0,
      );
      if (abuseCount >= ABUSE_AUTO_MATCH_THRESHOLD) {
        await this.audit.log({
          actorType: 'user',
          actorId: clientUserId,
          entity: 'request',
          entityId: clientUserId,
          transition: 'request.auto_match_blocked',
          payload: { abuseCount },
        });
        apiError(
          'AUTO_MATCH_DISABLED',
          'Автоподбор временно недоступен, выберите специалиста из каталога вручную',
          403,
        );
      }
    }

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
        // Явно из ClockService (а не @default(now()) БД) — иначе возраст
        // заявки для sweep-логики (120с NO_EXPERTS/рескан, задача 5) не
        // подчиняется виртуальному времени в тестах.
        createdAt: now,
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
  // Гонки (sweep задачи 5 vs decline, decline vs accept) закрыты двумя
  // рубежами: гейт по статусу SEARCHING + перечитка статуса непосредственно
  // перед create + частичный уникальный индекс
  // request_candidates_one_pending_uq (один PENDING на заявку) —
  // проигравший параллельный create ловит P2002.
  async offerToNext(requestId: string): Promise<boolean> {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: { topic: true },
    });
    if (!request || request.status !== RequestStatus.SEARCHING) return false;

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
      // До broadcast-эскалации (Р-16, задача 6) экстренная заявка ротируется
      // только среди acceptsUrgent-экспертов; после broadcastAt — полный
      // круг (расширение круга уже сделано EscalationService.broadcast(),
      // здесь urgentOnly=false просто не сужает дальнейшую ротацию).
      // Р-08 «приоритетный подбор»: Premium-заявка идёт строго к лучшему из
      // кандидатов, без разведения равных. Разведение (#29) существует ради
      // пропускной способности базового потока — Premium за то и платит,
      // чтобы попасть к сильнейшему из свободных, а не к случайному из
      // равных. Заведомо НЕ делаем: перехват уже отправленного оффера,
      // вытеснение чужой заявки, укорочение таймеров — это ухудшает опыт
      // базовых клиентов, чего Р-08 не обещал.
      const isPremium = await this.premium.isPremiumAt(
        request.clientUserId,
        this.clock.now(),
      );
      const ranked = await this.matching.findCandidates({
        topicSlug: request.topic.slug,
        format: request.format,
        excludeExpertIds,
        urgentOnly: request.isEmergency && !request.broadcastAt,
        // Равные по скору кандидаты раскладываются по-своему для каждой
        // заявки: иначе поток заявок бьётся в одного и того же
        // специалиста, а остальные свободные простаивают.
        tieBreakSeed: isPremium ? undefined : request.id,
      });
      nextExpertId = ranked[0];
    }

    if (!nextExpertId) return false;

    const now = this.clock.now();
    const deadlineAt = new Date(
      now.getTime() +
        (request.isEmergency ? EMERGENCY_DEADLINE_MS : NORMAL_DEADLINE_MS),
    );

    // Перечитка статуса НЕПОСРЕДСТВЕННО перед create: заявка могла быть
    // сматчена/отменена, пока считались кандидаты (гонка decline vs accept —
    // без этого возник бы фантомный PENDING на закрытой заявке).
    const stillSearching = await this.prisma.request.findFirst({
      where: { id: requestId, status: RequestStatus.SEARCHING },
      select: { id: true },
    });
    if (!stillSearching) return false;

    let offer: { id: string };
    try {
      offer = await this.prisma.requestCandidate.create({
        data: {
          requestId,
          expertId: nextExpertId,
          offeredAt: now,
          deadlineAt,
          response: CandidateResponse.PENDING,
        },
      });
    } catch (e) {
      // P2002 по request_candidates_one_pending_uq: параллельный offerToNext
      // (sweep vs decline) уже создал PENDING-оффер этой заявки. Ротация
      // выполнена другим потоком — это успех, не ошибка.
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002')
        return true;
      throw e;
    }

    await this.offerTimer.schedule(offer.id, deadlineAt);

    await this.audit.log({
      actorType: 'system',
      entity: 'offer',
      entityId: offer.id,
      transition: 'offer.sent',
      payload: { expertId: nextExpertId },
    });

    // PII-инвариант как в GET /v1/experts/me/offers (OfferDto) — никакого
    // clientUserId в payload.
    this.events.emitToExpert(nextExpertId, 'offer.new', {
      offerId: offer.id,
      topicSlug: request.topic.slug,
      format: request.format,
      isEmergency: request.isEmergency,
      clientCode: request.clientCode,
      deadlineAt,
    });

    // Критичный пуш эксперту (E9, задача 5): дублирует WS 'offer.new'
    // отдельным каналом (push + in-app центр + SMS-fallback 10с без ack).
    // dispatchToExpert сам никогда не бросает (fire-and-forget) — сбой шины
    // уведомлений не откатывает уже созданный оффер.
    await this.notifications.dispatchToExpert(nextExpertId, 'offer.incoming', {
      offerId: offer.id,
      requestId,
    });

    return true;
  }

  // Атомарное принятие оффера: оффер PENDING->ACCEPTED, заявка
  // SEARCHING->MATCHED и создание консультации (Р-13) — три шага в ОДНОЙ
  // транзакции. Гонки по-прежнему закрыты count-гейтами updateMany
  // (выигрывает ровно один), а сбой любого шага (в т.ч. создания
  // консультации) откатывает весь матч: заявка остаётся SEARCHING, оффер
  // PENDING — повторный accept возможен, «MATCHED без консультации» не
  // существует как наблюдаемое состояние. Проигравшие гейты сигналят
  // маркерными ошибками, снаружи замапленными в прежние коды 409/410.
  async claimOffer(
    offerId: string,
    expertId: string,
  ): Promise<Request & { consultationId: string }> {
    const offer = await this.prisma.requestCandidate.findUnique({
      where: { id: offerId },
    });
    if (!offer || offer.expertId !== expertId)
      apiError('OFFER_NOT_FOUND', 'Оффер не найден', 404);

    const now = this.clock.now();

    let matched: Request;
    let consultation: Consultation;
    try {
      ({ matched, consultation } = await this.prisma.$transaction(
        async (tx) => {
          const claimResult = await tx.requestCandidate.updateMany({
            where: { id: offerId, response: CandidateResponse.PENDING },
            data: { response: CandidateResponse.ACCEPTED, respondedAt: now },
          });
          if (claimResult.count === 0) throw new OfferClaimLostError();

          const matchResult = await tx.request.updateMany({
            where: { id: offer!.requestId, status: RequestStatus.SEARCHING },
            data: {
              status: RequestStatus.MATCHED,
              matchedExpertId: expertId,
              closedAt: now,
            },
          });
          if (matchResult.count === 0) throw new RequestNotSearchingError();

          const matchedRow = await tx.request.findUniqueOrThrow({
            where: { id: offer!.requestId },
          });
          const created = await this.consultations.createFromMatch(
            matchedRow,
            expertId,
            tx,
          );
          return { matched: matchedRow, consultation: created };
        },
      ));
    } catch (e) {
      if (e instanceof OfferClaimLostError) {
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
      if (e instanceof ConsultationSlotTakenError) {
        // Эксперт уже ведёт консультацию: BUSY выставляется после коммита
        // первого accept, поэтому второй оффер он получить успевает.
        // Отказ штатный, но оставлять оффер висеть PENDING до 45-секундного
        // таймаута нельзя: под пиковой нагрузкой десятки заявок ждали бы
        // впустую (видно в нагрузочном прогоне E11). Поступаем как с
        // отказом эксперта — снимаем оффер и сразу предлагаем следующему.
        await this.offerTimer.cancel(offerId);
        await this.prisma.requestCandidate.updateMany({
          where: { id: offerId, response: CandidateResponse.PENDING },
          data: { response: CandidateResponse.REVOKED, respondedAt: now },
        });
        await this.audit.log({
          actorType: 'system',
          entity: 'offer',
          entityId: offerId,
          transition: 'offer.revoked',
          payload: { reason: 'expert_busy' },
        });
        await this.offerToNext(offer!.requestId);
        apiError(
          'EXPERT_BUSY',
          'У вас уже идёт консультация — этот запрос уйдёт другому специалисту',
          409,
        );
      }
      if (e instanceof RequestNotSearchingError) {
        // Заявка уже закрыта (отменена/сматчена иначе). Транзакция
        // откатилась — оффер снова PENDING, ревокируем его как раньше.
        await this.offerTimer.cancel(offerId);
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
      throw e;
    }

    await this.offerTimer.cancel(offerId);

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

    // Сайд-эффекты матча (авто-BUSY, audit consultation.created, WS
    // эксперту) — ПОСЛЕ коммита, ДО revokeOtherPendingOffers/эмитов клиенту.
    await this.consultations.applyMatchSideEffects(consultation);

    await this.revokeOtherPendingOffers(offer!.requestId, offerId);

    const matchedExpert = await this.experts.findPublicById(expertId);
    this.events.emitToUser(matched.clientUserId, 'request.updated', {
      id: matched.id,
      status: matched.status,
      matchedExpert,
      consultationId: consultation.id,
    });

    return { ...matched, consultationId: consultation.id };
  }

  async acceptOffer(
    offerId: string,
    expertId: string,
  ): Promise<AcceptOfferDto> {
    const request = await this.claimOffer(offerId, expertId);
    return {
      requestId: request.id,
      status: request.status,
      consultationId: request.consultationId,
    };
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

    this.events.emitToUser(clientUserId, 'request.updated', {
      id: fresh.id,
      status: fresh.status,
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
      this.events.emitToExpert(p.expertId, 'offer.revoked', {
        offerId: p.id,
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
      // Консультация создаётся сразу при матче (claimOffer -> createFromMatch,
      // Р-13) — клиент видит её id прямо в статусе заявки.
      const consultation = await this.prisma.consultation.findUnique({
        where: { requestId: request.id },
        select: { id: true },
      });
      if (consultation) dto.consultationId = consultation.id;
    }
    if (request.status === RequestStatus.CALLBACK_REQUESTED) {
      dto.hotlines = HOTLINES;
    }
    return dto;
  }
}
