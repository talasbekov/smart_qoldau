import { Injectable } from '@nestjs/common';
import {
  Expert,
  Payout,
  PayoutStatus,
  VerificationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { EventsService } from '../ws/events.service';
import { apiError } from '../common/filters/app-exception.filter';
import {
  ACC_PAYOUT_PENDING,
  expertAccount,
  LedgerService,
} from '../ledger/ledger.service';
import { PaymentProviderPort } from '../payments/provider/payment-provider.port';
import { NotificationsService } from '../notifications/notifications.service';
import { PayoutProviderPort } from './provider/payout-provider.port';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { PayoutDto } from './dto/payout.dto';
import { PayoutsListDto } from './dto/payouts-list.dto';
import { BalanceDto } from './dto/balance.dto';
import { ListPayoutsDto } from './dto/list-payouts.dto';
import { AdminPayoutsListDto } from './dto/admin-payouts-list.dto';

const MIN_PAYOUT_TIYN = 1_000_000; // 10 000 ₸ — минимум вывода (Р-06)
const MONTHLY_AUTO_APPROVE_LIMIT_TIYN = 30_000_000; // 300 000 ₸/мес (Р-06)
const DEFAULT_TAKE = 20;
const MAX_TAKE = 100;

@Injectable()
export class PayoutsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private clock: ClockService,
    private ledger: LedgerService,
    // Токенизация карты вывода переиспользует платёжный провайдер (та же
    // карточная инфраструктура), сама выплата идёт через payout-провайдер.
    private paymentProvider: PaymentProviderPort,
    private payoutProvider: PayoutProviderPort,
    private events: EventsService,
    private notifications: NotificationsService,
  ) {}

  // GET /v1/experts/me/balance. available == balance: резерв вывода
  // (payout_reserve) списывает сумму со счёта эксперта прямо в заявке,
  // поэтому «доступно» уже учтено ledger'ом (см. BalanceDto).
  async getBalance(expertId: string): Promise<BalanceDto> {
    const balanceTiyn = await this.ledger.balanceTiyn(expertAccount(expertId));
    return { balanceTiyn, availableTiyn: balanceTiyn };
  }

  // POST /v1/payouts — только верифицированный эксперт. Проверка баланса,
  // токенизация карты, создание Payout и резерв ledger — в одной транзакции
  // под row-lock'ом эксперта (SELECT ... FOR UPDATE, паттерн rating E4):
  // два параллельных вывода сериализуются, второй видит уже списанный
  // резерв первого и получает INSUFFICIENT_BALANCE.
  async request(expert: Expert, dto: RequestPayoutDto): Promise<PayoutDto> {
    if (expert.verificationStatus !== VerificationStatus.VERIFIED) {
      apiError(
        'NOT_VERIFIED',
        'Только верифицированный эксперт может выводить средства',
        403,
      );
    }
    if (dto.amountTiyn < MIN_PAYOUT_TIYN) {
      apiError(
        'PAYOUT_MIN_AMOUNT',
        `Минимальная сумма вывода — ${MIN_PAYOUT_TIYN} тиын`,
        400,
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM experts WHERE id = ${expert.id} FOR UPDATE`;

      const balanceTiyn = await this.ledger.balanceTiyn(
        expertAccount(expert.id),
        tx,
      );
      if (dto.amountTiyn > balanceTiyn) {
        apiError('INSUFFICIENT_BALANCE', 'Недостаточно средств', 400);
      }

      const { token, maskedPan } = await this.paymentProvider.tokenizeCard({
        pan: dto.pan,
        expiry: dto.expiry,
        holderName: dto.holderName,
      });

      // Календарный месяц по UTC — достаточно для лимита финконтроля;
      // граница месяца в таймзоне пользователя тут некритична.
      const monthStart = this.currentMonthStart();
      const monthAgg = await tx.payout.aggregate({
        where: {
          expertId: expert.id,
          status: { not: PayoutStatus.REJECTED },
          createdAt: { gte: monthStart },
        },
        _sum: { amountTiyn: true },
      });
      const monthSumTiyn = monthAgg._sum.amountTiyn ?? 0;
      const autoApproved =
        monthSumTiyn + dto.amountTiyn <= MONTHLY_AUTO_APPROVE_LIMIT_TIYN;

      const payout = await tx.payout.create({
        data: {
          expertId: expert.id,
          amountTiyn: dto.amountTiyn,
          maskedPan,
          holderName: dto.holderName,
          cardToken: token,
          status: autoApproved
            ? PayoutStatus.PROCESSING
            : PayoutStatus.PENDING_REVIEW,
          reviewedBy: autoApproved ? 'auto' : null,
        },
      });

      await this.ledger.post(
        'payout_reserve',
        payout.id,
        [
          { account: expertAccount(expert.id), debitTiyn: dto.amountTiyn },
          { account: ACC_PAYOUT_PENDING, creditTiyn: dto.amountTiyn },
        ],
        tx,
      );

      return payout;
    });

    const autoApproved = created.status === PayoutStatus.PROCESSING;

    await this.audit.log({
      actorType: 'user',
      actorId: expert.userId,
      entity: 'payout',
      entityId: created.id,
      transition: 'payout.requested',
      payload: { amountTiyn: dto.amountTiyn, autoApproved },
    });

    // Провайдер вызывается ПОСЛЕ коммита резерва: сбой сети здесь оставит
    // Payout PROCESSING без providerRefId — деньги уже зарезервированы,
    // повторная отправка возможна идемпотентным ключом payout:{id}.
    // PENDING_REVIEW провайдера не трогает — решение за финконтролем.
    let result = created;
    if (autoApproved) {
      result = await this.sendToProvider(created);
    }

    return this.toDto(result);
  }

  // Ретрай застрявших отправок (вызывается из OfferTimerService.sweep):
  // PROCESSING без providerRefId = сбой между коммитом резерва/статуса и
  // sendToCard (или между sendToCard и записью refId). Резерв уже снят, и
  // без дожима деньги эксперта висели бы в payout:pending навсегда: повторный
  // approve вернёт 409, reject берёт только PENDING_REVIEW, а вебхук paid
  // ищет по providerRefId. Ключ payout:{id} идемпотентен — гонка с ещё
  // живым первым вызовом безопасна (провайдер вернёт тот же refId).
  async retryStrandedSends(): Promise<number> {
    const stranded = await this.prisma.payout.findMany({
      where: { status: PayoutStatus.PROCESSING, providerRefId: null },
      take: 50,
    });

    let processed = 0;
    for (const payout of stranded) {
      processed++;
      try {
        await this.sendToProvider(payout);
      } catch {
        // Провайдер всё ещё недоступен — следующий sweep попробует снова.
      }
    }
    return processed;
  }

  // Единственная точка вызова payout-провайдера — и для автоодобрения, и
  // для ручного approve финконтроля. Ключ payout:{id} идемпотентен: повтор
  // после сбоя записи providerRefId вернёт тот же refId.
  private async sendToProvider(payout: Payout): Promise<Payout> {
    const sent = await this.payoutProvider.sendToCard({
      idempotencyKey: `payout:${payout.id}`,
      cardToken: payout.cardToken,
      amountTiyn: payout.amountTiyn,
    });
    return this.prisma.payout.update({
      where: { id: payout.id },
      data: { providerRefId: sent.providerRefId },
    });
  }

  // GET /v1/admin/payouts?status=… — очередь финконтроля (по умолчанию
  // PENDING_REVIEW), старые сверху; monthTotalTiyn — сумма выводов эксперта
  // за текущий календарный месяц (кроме REJECTED), контекст для решения.
  // Пагинация как в list(): без неё запрос по PAID/REJECTED отдавал бы всю
  // историю выводов одним ответом.
  async adminList(
    status?: PayoutStatus,
    filters: { take?: number; skip?: number } = {},
  ): Promise<AdminPayoutsListDto> {
    const take = Math.min(filters.take ?? DEFAULT_TAKE, MAX_TAKE);
    const skip = filters.skip ?? 0;
    const payouts = await this.prisma.payout.findMany({
      where: { status: status ?? PayoutStatus.PENDING_REVIEW },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take,
      skip,
    });

    const expertIds = [...new Set(payouts.map((p) => p.expertId))];
    const totals = expertIds.length
      ? await this.prisma.payout.groupBy({
          by: ['expertId'],
          where: {
            expertId: { in: expertIds },
            status: { not: PayoutStatus.REJECTED },
            createdAt: { gte: this.currentMonthStart() },
          },
          _sum: { amountTiyn: true },
        })
      : [];
    const totalByExpert = new Map(
      totals.map((t) => [t.expertId, t._sum.amountTiyn ?? 0]),
    );

    return {
      items: payouts.map((p) => ({
        id: p.id,
        expertId: p.expertId,
        amountTiyn: p.amountTiyn,
        maskedPan: p.maskedPan,
        holderName: p.holderName,
        monthTotalTiyn: totalByExpert.get(p.expertId) ?? 0,
        createdAt: p.createdAt,
      })),
    };
  }

  // POST /v1/admin/payouts/:id/approve — только из PENDING_REVIEW.
  // updateMany со status-фильтром: два параллельных approve (или гонка с
  // reject) — победит ровно один, второй получит 409.
  async approve(payoutId: string, actorId: string): Promise<void> {
    const updated = await this.prisma.payout.updateMany({
      where: { id: payoutId, status: PayoutStatus.PENDING_REVIEW },
      data: { status: PayoutStatus.PROCESSING, reviewedBy: actorId },
    });
    if (updated.count === 0) {
      await this.notPendingError(payoutId);
    }

    const payout = await this.prisma.payout.findUniqueOrThrow({
      where: { id: payoutId },
    });

    await this.audit.log({
      actorType: 'admin',
      actorId,
      entity: 'payout',
      entityId: payoutId,
      transition: 'payout.approved',
      payload: { amountTiyn: payout.amountTiyn },
    });

    await this.sendToProvider(payout);

    this.events.emitToExpert(payout.expertId, 'payout.updated', {
      id: payoutId,
      status: PayoutStatus.PROCESSING,
    });
  }

  // POST /v1/admin/payouts/:id/reject {reason} — Р-06 «отклонение с
  // причиной». Смена статуса и компенсирующая проводка (возврат резерва на
  // баланс эксперта) атомарны.
  async reject(
    payoutId: string,
    reason: string,
    actorId: string,
  ): Promise<void> {
    const payout = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payout.updateMany({
        where: { id: payoutId, status: PayoutStatus.PENDING_REVIEW },
        data: {
          status: PayoutStatus.REJECTED,
          rejectReason: reason,
          reviewedBy: actorId,
        },
      });
      if (updated.count === 0) return null;

      const p = await tx.payout.findUniqueOrThrow({
        where: { id: payoutId },
      });
      await this.ledger.post(
        'payout_reject',
        payoutId,
        [
          { account: ACC_PAYOUT_PENDING, debitTiyn: p.amountTiyn },
          { account: expertAccount(p.expertId), creditTiyn: p.amountTiyn },
        ],
        tx,
      );
      return p;
    });
    if (!payout) {
      await this.notPendingError(payoutId);
      return;
    }

    await this.audit.log({
      actorType: 'admin',
      actorId,
      entity: 'payout',
      entityId: payoutId,
      transition: 'payout.rejected',
      payload: { amountTiyn: payout.amountTiyn, reason },
    });

    this.events.emitToExpert(payout.expertId, 'payout.updated', {
      id: payoutId,
      status: PayoutStatus.REJECTED,
      rejectReason: reason,
    });

    // In-app + push (E9, задача 6): dispatchToExpert сам никогда не бросает
    // (fire-and-forget) — сбой шины уведомлений не откатывает уже
    // зафиксированный отказ и компенсирующую проводку.
    await this.notifications.dispatchToExpert(
      payout.expertId,
      'payout.rejected',
      {
        reason,
        amountTiyn: payout.amountTiyn,
        status: PayoutStatus.REJECTED,
      },
    );
  }

  private async notPendingError(payoutId: string): Promise<never> {
    const exists = await this.prisma.payout.findUnique({
      where: { id: payoutId },
      select: { id: true },
    });
    if (!exists) {
      apiError('PAYOUT_NOT_FOUND', 'Вывод не найден', 404);
    }
    apiError('PAYOUT_NOT_PENDING', 'Вывод не в очереди финконтроля', 409);
  }

  private currentMonthStart(): Date {
    const now = this.clock.now();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  // GET /v1/payouts — свои выводы, новые сверху.
  async list(
    expertId: string,
    filters: ListPayoutsDto,
  ): Promise<PayoutsListDto> {
    const take = Math.min(filters.take ?? DEFAULT_TAKE, MAX_TAKE);
    const skip = filters.skip ?? 0;

    const payouts = await this.prisma.payout.findMany({
      where: { expertId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
    });

    return { items: payouts.map((p) => this.toDto(p)) };
  }

  private toDto(p: Payout): PayoutDto {
    return {
      id: p.id,
      amountTiyn: p.amountTiyn,
      maskedPan: p.maskedPan,
      status: p.status,
      rejectReason: p.rejectReason,
      createdAt: p.createdAt,
    };
  }
}
