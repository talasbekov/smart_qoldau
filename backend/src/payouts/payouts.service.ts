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
import { apiError } from '../common/filters/app-exception.filter';
import {
  ACC_PAYOUT_PENDING,
  expertAccount,
  LedgerService,
} from '../ledger/ledger.service';
import { PaymentProviderPort } from '../payments/provider/payment-provider.port';
import { PayoutProviderPort } from './provider/payout-provider.port';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { PayoutDto } from './dto/payout.dto';
import { PayoutsListDto } from './dto/payouts-list.dto';
import { BalanceDto } from './dto/balance.dto';
import { ListPayoutsDto } from './dto/list-payouts.dto';

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
      const now = this.clock.now();
      const monthStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
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
    // PENDING_REVIEW провайдера не трогает — решение за финконтролем (Task 8).
    let result = created;
    if (autoApproved) {
      const sent = await this.payoutProvider.sendToCard({
        idempotencyKey: `payout:${created.id}`,
        cardToken: created.cardToken,
        amountTiyn: created.amountTiyn,
      });
      result = await this.prisma.payout.update({
        where: { id: created.id },
        data: { providerRefId: sent.providerRefId },
      });
    }

    return this.toDto(result);
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
      orderBy: { createdAt: 'desc' },
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
