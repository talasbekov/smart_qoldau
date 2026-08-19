import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { CandidateResponse, RequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { MatchingService } from '../matching/matching.service';
import {
  OFFER_TIMER_REGISTRY,
  OfferTimerRegistry,
} from './offer-timer.registry';
import { EventsService } from '../ws/events.service';

const HOTLINES = ['150', '103', '112'];

// Дедлайн broadcast-оффера — как у обычного экстренного оффера (Р-16 §11.5).
const EMERGENCY_DEADLINE_MS = 20_000;
// Момент broadcast-эскалации: SEARCHING emergency-заявка старше этого
// возраста без ответа расширяет круг кандидатов на весь пул (без
// acceptsUrgent-фильтра) и рассылает офферы всем разом.
const BROADCAST_AGE_MS = 120_000;
// Момент отказа от матчинга: SEARCHING emergency-заявка старше этого
// возраста закрывается в CALLBACK_REQUESTED с горячими линиями.
const CALLBACK_AGE_MS = 300_000;

// Р-16: экстренная эскалация. Вызывается четвёртым шагом sweep() в
// OfferTimerService (собственный try/catch — сбой эскалации не должен
// мешать обработке дедлайнов офферов/рескана/обычного stale-закрытия).
//
// До 120с emergency-заявка ротируется ТОЛЬКО среди acceptsUrgent-экспертов
// (offerToNext передаёт urgentOnly = isEmergency && !broadcastAt). После
// broadcast() круг кандидатов полный (urgentOnly=false), и broadcast создаёт
// PENDING-офферы ВСЕМ найденным кандидатам одним проходом — это единственный
// случай в системе, когда у заявки может быть больше одного одновременного
// PENDING-оффера (см. комментарий у частичного индекса
// request_candidates_pending_per_expert_uq в schema.prisma).
@Injectable()
export class EscalationService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private clock: ClockService,
    private matching: MatchingService,
    private events: EventsService,
    @Inject(forwardRef(() => OFFER_TIMER_REGISTRY))
    private offerTimer: OfferTimerRegistry,
  ) {}

  // Единый шаг эскалации: сначала callback (для заявок ≥300с — иначе
  // broadcast() бессмысленно создавал бы офферы заявке, которая тут же
  // закроется), затем broadcast (для заявок ≥120с и <300с, ещё без
  // broadcastAt).
  async escalate(): Promise<void> {
    await this.escalateCallbacks();
    await this.escalateBroadcasts();
  }

  private async escalateBroadcasts(): Promise<void> {
    const now = this.clock.now();
    const cutoff = new Date(now.getTime() - BROADCAST_AGE_MS);

    const candidates = await this.prisma.request.findMany({
      where: {
        status: RequestStatus.SEARCHING,
        isEmergency: true,
        broadcastAt: null,
        createdAt: { lte: cutoff },
      },
      include: { topic: true },
    });

    for (const req of candidates) {
      await this.broadcastOne(
        req.id,
        req.topic.slug,
        req.format,
        req.clientCode,
      );
    }
  }

  // Рассылает PENDING-офферы всем свежим/допустимым кандидатам заявки
  // (полный круг, без urgentOnly), исключая экспертов, которые уже как-то
  // ответили этой заявке (любой response, включая уже TIMEOUT/DECLINED —
  // повторно спрашивать их не нужно).
  private async broadcastOne(
    requestId: string,
    topicSlug: string,
    format: string,
    clientCode: number,
  ): Promise<void> {
    const existing = await this.prisma.requestCandidate.findMany({
      where: { requestId },
      select: { expertId: true },
    });
    const excludeExpertIds = existing.map((c) => c.expertId);

    const candidateIds = await this.matching.findCandidates({
      topicSlug,
      format,
      excludeExpertIds,
      urgentOnly: false,
    });

    const now = this.clock.now();

    // Перечитка статуса непосредственно перед записью — заявка могла быть
    // сматчена/отменена, пока считались кандидаты.
    const stillSearching = await this.prisma.request.findFirst({
      where: {
        id: requestId,
        status: RequestStatus.SEARCHING,
        broadcastAt: null,
      },
      select: { id: true },
    });
    if (!stillSearching) return;

    // broadcastAt проставляем всегда (даже при пустом пуле кандидатов) —
    // иначе следующий sweep будет пытаться broadcast повторно на каждом
    // тике; сама заявка при пустом пуле остаётся SEARCHING без офферов до
    // callback-эскалации на 300с.
    await this.prisma.request.update({
      where: { id: requestId },
      data: { broadcastAt: now },
    });

    const deadlineAt = new Date(now.getTime() + EMERGENCY_DEADLINE_MS);
    const createdOffers: { id: string; expertId: string }[] = [];
    for (const expertId of candidateIds) {
      try {
        const offer = await this.prisma.requestCandidate.create({
          data: {
            requestId,
            expertId,
            offeredAt: now,
            deadlineAt,
            response: CandidateResponse.PENDING,
          },
        });
        createdOffers.push({ id: offer.id, expertId });
      } catch {
        // P2002 по request_candidates_pending_per_expert_uq — этому эксперту
        // уже есть PENDING этой заявки (гонка с offerToNext/другим
        // sweep-тиком) — пропускаем, не ошибка.
        continue;
      }
    }

    const createdOfferIds = createdOffers.map((o) => o.id);
    for (const offer of createdOffers) {
      await this.offerTimer.schedule(offer.id, deadlineAt);
      this.events.emitToExpert(offer.expertId, 'offer.new', {
        offerId: offer.id,
        topicSlug,
        format,
        isEmergency: true,
        clientCode,
        deadlineAt,
      });
    }

    await this.audit.log({
      actorType: 'system',
      entity: 'request',
      entityId: requestId,
      transition: 'request.broadcast',
      payload: { candidateCount: createdOfferIds.length },
    });
  }

  private async escalateCallbacks(): Promise<void> {
    const now = this.clock.now();
    const cutoff = new Date(now.getTime() - CALLBACK_AGE_MS);

    const stale = await this.prisma.request.findMany({
      where: {
        status: RequestStatus.SEARCHING,
        isEmergency: true,
        createdAt: { lte: cutoff },
      },
      select: { id: true, clientUserId: true },
    });

    for (const req of stale) {
      await this.callbackOne(req.id, req.clientUserId, now);
    }
  }

  private async callbackOne(
    requestId: string,
    clientUserId: string,
    now: Date,
  ): Promise<void> {
    const closeResult = await this.prisma.request.updateMany({
      where: { id: requestId, status: RequestStatus.SEARCHING },
      data: { status: RequestStatus.CALLBACK_REQUESTED, closedAt: now },
    });
    if (closeResult.count === 0) return;

    const pending = await this.prisma.requestCandidate.findMany({
      where: { requestId, response: CandidateResponse.PENDING },
    });

    if (pending.length > 0) {
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

    await this.audit.log({
      actorType: 'system',
      entity: 'request',
      entityId: requestId,
      transition: 'request.callback_requested',
    });

    this.events.emitToUser(clientUserId, 'request.updated', {
      id: requestId,
      status: RequestStatus.CALLBACK_REQUESTED,
      hotlines: HOTLINES,
    });
  }
}
