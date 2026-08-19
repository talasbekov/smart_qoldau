import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { CandidateResponse, RequestStatus } from '@prisma/client';
import { RedisService } from '../redis/redis.service';
import { ClockService } from '../common/clock/clock.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OfferTimerRegistry } from './offer-timer.registry';
// RequestsService <-> OfferTimerService — циклическая зависимость
// (RequestsService.offerToNext вызывает offerTimer.schedule/cancel;
// OfferTimerService.sweep вызывает requestsService.offerToNext) —
// разрешается forwardRef() на обеих сторонах инъекции.
import { RequestsService } from './requests.service';
import { EscalationService } from './escalation.service';
import { EventsService } from '../ws/events.service';

export const OFFERS_DEADLINES_KEY = 'offers:deadlines';
export const REQUESTS_RESCAN_KEY = 'requests:rescan';

// Заявка обычного (не emergency) приоритета закрывается в NO_EXPERTS только
// после этого возраста без PENDING-офферов (Р-10 / ТЗ §11.3).
const REQUEST_MAX_AGE_MS = 120_000;
// Шаг повторного скана заявки, если пул кандидатов временно пуст, но заявка
// ещё не достигла предельного возраста.
const RESCAN_DELAY_MS = 5_000;

// Реальная реализация OfferTimerRegistry на Redis ZSET. Дедлайны офферов
// переживают рестарт процесса — они лежат в Redis, а не в памяти; после
// рестарта первый sweep() подбирает все просроченные дедлайны.
@Injectable()
export class OfferTimerService implements OfferTimerRegistry {
  private readonly logger = new Logger(OfferTimerService.name);

  constructor(
    private redis: RedisService,
    private clock: ClockService,
    private prisma: PrismaService,
    private audit: AuditService,
    private events: EventsService,
    @Inject(forwardRef(() => RequestsService))
    private requestsService: RequestsService,
    @Inject(forwardRef(() => EscalationService))
    private escalation: EscalationService,
  ) {}

  async schedule(offerId: string, deadlineAt: Date): Promise<void> {
    await this.redis.zadd(OFFERS_DEADLINES_KEY, deadlineAt.getTime(), offerId);
  }

  async cancel(offerId: string): Promise<void> {
    await this.redis.zrem(OFFERS_DEADLINES_KEY, offerId);
  }

  // Прод-тик: раз в секунду. В тестах (NODE_ENV=test) не тикает — sweep()
  // вызывается вручную на виртуальном времени.
  @Interval(1000)
  async tick(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    // @nestjs/schedule не оборачивает async-исключения — без catch
    // транзиентная ошибка Redis/БД дала бы unhandled rejection.
    try {
      await this.sweep();
    } catch (e) {
      this.logger.error(
        `sweep tick failed: ${e instanceof Error ? e.message : String(e)}`,
        e instanceof Error ? e.stack : undefined,
      );
    }
  }

  // Единый тик обработки просроченных таймеров. Порядок важен:
  //   1) истёкшие офферы -> TIMEOUT -> ротация следующему кандидату;
  //   2) отложенный рескан заявок с временно пустым пулом кандидатов;
  //   3) закрытие заявок старше 120с без PENDING-офферов -> NO_EXPERTS
  //      (кроме emergency — у них своя эскалация, шаг 4, Р-16);
  //   4) экстренная эскалация Р-16 (EscalationService): SEARCHING emergency
  //      ≥120с без broadcastAt -> broadcast всем кандидатам; ≥300с ->
  //      CALLBACK_REQUESTED + горячие линии.
  // Возвращает число обработанных истёкших офферов (шаг 1).
  // Каждый шаг изолирован собственным try/catch: сбой одного (например,
  // транзиентная ошибка Redis в рескане) не блокирует остальные.
  async sweep(): Promise<number> {
    let processed = 0;
    try {
      processed = await this.sweepExpiredOffers();
    } catch (e) {
      this.logStepError('sweepExpiredOffers', e);
    }
    try {
      await this.sweepRescans();
    } catch (e) {
      this.logStepError('sweepRescans', e);
    }
    try {
      await this.sweepStaleRequests();
    } catch (e) {
      this.logStepError('sweepStaleRequests', e);
    }
    try {
      await this.escalation.escalate();
    } catch (e) {
      this.logStepError('escalation', e);
    }
    return processed;
  }

  private async sweepExpiredOffers(): Promise<number> {
    const now = this.clock.now().getTime();
    const expiredOfferIds = await this.redis.zrangebyscore(
      OFFERS_DEADLINES_KEY,
      '-inf',
      now,
    );
    if (expiredOfferIds.length === 0) return 0;

    // Изоляция ошибок: исключение на одном оффере не обрывает обработку
    // остальных истёкших офферов этого тика.
    for (const offerId of expiredOfferIds) {
      try {
        await this.timeoutOffer(offerId);
      } catch (e) {
        this.logger.error(
          `timeoutOffer failed for offer ${offerId}: ${
            e instanceof Error ? e.message : String(e)
          }`,
          e instanceof Error ? e.stack : undefined,
        );
      }
    }
    return expiredOfferIds.length;
  }

  private async timeoutOffer(offerId: string): Promise<void> {
    const nowDate = this.clock.now();
    const offer = await this.prisma.requestCandidate.findUnique({
      where: { id: offerId },
    });

    const result = await this.prisma.requestCandidate.updateMany({
      where: { id: offerId, response: CandidateResponse.PENDING },
      data: { response: CandidateResponse.TIMEOUT, respondedAt: nowDate },
    });

    // ZREM всегда — идемпотентно снимает дедлайн независимо от того, кто
    // выиграл гонку (sweep vs accept/decline, которые уже сами вызвали
    // cancel(), так что тут это обычно уже no-op).
    await this.redis.zrem(OFFERS_DEADLINES_KEY, offerId);

    if (result.count === 0 || !offer) {
      // Уже обработан (accept/decline/revoke опередили sweep) — ничего
      // больше делать не нужно.
      return;
    }

    await this.audit.log({
      actorType: 'system',
      entity: 'offer',
      entityId: offerId,
      transition: 'offer.timeout',
      payload: { expertId: offer.expertId },
    });

    this.events.emitToExpert(offer.expertId, 'offer.revoked', { offerId });

    // Пост-TIMEOUT шаги изолированы: оффер уже TIMEOUT + ZREM, и если
    // ротация упадёт, заявка осталась бы без PENDING-оффера и без рескана.
    // При ошибке — принудительный ZADD в requests:rescan, чтобы следующий
    // sweep повторил ротацию.
    try {
      const rotated = await this.requestsService.offerToNext(offer.requestId);
      if (!rotated) {
        await this.maybeScheduleRescan(offer.requestId);
      }
    } catch (e) {
      this.logger.error(
        `offerToNext failed after timeout of offer ${offerId} ` +
          `(request ${offer.requestId}): ${
            e instanceof Error ? e.message : String(e)
          }`,
        e instanceof Error ? e.stack : undefined,
      );
      await this.redis.zadd(
        REQUESTS_RESCAN_KEY,
        this.clock.now().getTime() + RESCAN_DELAY_MS,
        offer.requestId,
      );
    }
  }

  private async sweepRescans(): Promise<void> {
    const now = this.clock.now().getTime();
    const dueRequestIds = await this.redis.zrangebyscore(
      REQUESTS_RESCAN_KEY,
      '-inf',
      now,
    );
    if (dueRequestIds.length === 0) return;

    for (const requestId of dueRequestIds) {
      await this.redis.zrem(REQUESTS_RESCAN_KEY, requestId);

      const request = await this.prisma.request.findUnique({
        where: { id: requestId },
      });
      if (!request || request.status !== RequestStatus.SEARCHING) continue;

      const pending = await this.prisma.requestCandidate.findFirst({
        where: { requestId, response: CandidateResponse.PENDING },
        select: { id: true },
      });
      if (pending) continue;

      const rotated = await this.requestsService.offerToNext(requestId);
      if (!rotated) {
        await this.maybeScheduleRescan(requestId, request.createdAt);
      }
    }
  }

  private async sweepStaleRequests(): Promise<void> {
    const now = this.clock.now();
    const cutoff = new Date(now.getTime() - REQUEST_MAX_AGE_MS);

    const staleRequests = await this.prisma.request.findMany({
      where: {
        status: RequestStatus.SEARCHING,
        isEmergency: false,
        createdAt: { lte: cutoff },
      },
    });

    for (const req of staleRequests) {
      const pending = await this.prisma.requestCandidate.findFirst({
        where: { requestId: req.id, response: CandidateResponse.PENDING },
        select: { id: true },
      });
      if (pending) continue;

      const closeResult = await this.prisma.request.updateMany({
        where: { id: req.id, status: RequestStatus.SEARCHING },
        data: { status: RequestStatus.NO_EXPERTS, closedAt: now },
      });
      if (closeResult.count === 0) continue;

      await this.redis.zrem(REQUESTS_RESCAN_KEY, req.id);

      await this.audit.log({
        actorType: 'system',
        entity: 'request',
        entityId: req.id,
        transition: 'request.no_experts',
      });

      this.events.emitToUser(req.clientUserId, 'request.updated', {
        id: req.id,
        status: RequestStatus.NO_EXPERTS,
      });
    }
  }

  // Планирует повторный скан заявки, если она ещё не достигла предельного
  // возраста (иначе следующий sweepStaleRequests закроет её в NO_EXPERTS).
  private async maybeScheduleRescan(
    requestId: string,
    createdAt?: Date,
  ): Promise<void> {
    const request =
      createdAt !== undefined
        ? { createdAt }
        : await this.prisma.request.findUnique({
            where: { id: requestId },
            select: { createdAt: true },
          });
    if (!request) return;

    const now = this.clock.now();
    const age = now.getTime() - request.createdAt.getTime();
    if (age >= REQUEST_MAX_AGE_MS) return;

    await this.redis.zadd(
      REQUESTS_RESCAN_KEY,
      now.getTime() + RESCAN_DELAY_MS,
      requestId,
    );
  }

  private logStepError(step: string, e: unknown): void {
    this.logger.error(
      `sweep step ${step} failed: ${
        e instanceof Error ? e.message : String(e)
      }`,
      e instanceof Error ? e.stack : undefined,
    );
  }
}
