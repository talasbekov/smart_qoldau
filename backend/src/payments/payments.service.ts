import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import {
  ConsultationOutcome,
  ConsultationPaymentStatus,
  ConsultationStatus,
  PaymentStatus,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { EventsService } from '../ws/events.service';
import { apiError } from '../common/filters/app-exception.filter';
import { ConsultationsService } from '../consultations/consultations.service';
import {
  ACC_ACQUIRER,
  ACC_COMMISSION,
  expertAccount,
  LedgerService,
} from '../ledger/ledger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PremiumService } from '../premium/premium.service';
import {
  COMMISSION_BP_PREMIUM,
  COMMISSION_BP_REGULAR,
  PREMIUM_DISCOUNT_BP,
} from '../premium/premium.constants';
import { formatTenge } from '../notifications/notification-templates';
import { PaymentProviderPort } from './provider/payment-provider.port';
import { PayResultDto } from './dto/pay-result.dto';
import { PaymentStatusDto } from './dto/payment-status.dto';
import { EarningsDto } from './dto/earnings.dto';
import { ListEarningsDto } from './dto/list-earnings.dto';

// Ставка комиссии переехала в premium.constants как COMMISSION_BP_REGULAR
// (базисные пункты): с приходом Premium ставок стало две, и держать их в
// разных файлах — верный способ развести их значения.
const DEFAULT_TAKE = 20;
const MAX_TAKE = 100;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private clock: ClockService,
    private events: EventsService,
    private consultations: ConsultationsService,
    private provider: PaymentProviderPort,
    private ledger: LedgerService,
    private notifications: NotificationsService,
    @Inject(forwardRef(() => PremiumService))
    private premium: PremiumService,
  ) {}

  // POST /v1/consultations/:id/pay — только клиент-участник ACTIVE-
  // консультации. Поток: upsert Payment (P2002 -> уже существующий; повтор
  // после FAILED — та же строка, сброс в PENDING с новой картой) ->
  // provider.hold(idempotencyKey='hold:'+consultationId) -> held: Payment
  // HELD + Consultation.paymentStatus HELD; declined: Payment FAILED +
  // paymentStatus FAILED, 402 PROVIDER_DECLINED.
  async pay(
    consultationId: string,
    userSub: string,
    paymentMethodId: string,
  ): Promise<PayResultDto> {
    const { consultation, role } = await this.consultations.resolveParticipant(
      consultationId,
      userSub,
    );
    if (role !== 'client') {
      apiError('CONSULTATION_NOT_FOUND', 'Консультация не найдена', 404);
    }
    // Плановая консультация (E6b) оплачивается в момент записи, когда она
    // ещё SCHEDULED: холд ставится заранее, а списание идёт по исходу.
    if (
      consultation.status !== ConsultationStatus.ACTIVE &&
      consultation.status !== ConsultationStatus.SCHEDULED
    ) {
      apiError('CONSULTATION_NOT_ACTIVE', 'Консультация не активна', 409);
    }

    const method = await this.prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId: userSub, deletedAt: null },
    });
    if (!method) {
      apiError('PAYMENT_METHOD_NOT_FOUND', 'Способ оплаты не найден', 404);
    }

    const existing = await this.prisma.payment.findUnique({
      where: { consultationId },
    });
    if (
      existing &&
      (existing.status === PaymentStatus.HELD ||
        existing.status === PaymentStatus.CAPTURED)
    ) {
      apiError('ALREADY_PAID', 'Консультация уже оплачена', 409);
    }

    const isPremium = await this.premium.isPremiumAt(
      consultation.clientUserId,
      this.clock.now(),
    );
    const fullPriceTiyn = consultation.priceTiyn;
    // Р-03: клиент платит на 10 % меньше, а эксперт всё равно получает 85 %
    // ПОЛНОЙ цены — скидку оплачивает платформа из своей комиссии (5 %
    // вместо 15 %). Поэтому и скидка, и комиссия считаются от полной цены,
    // а не от суммы со скидкой: иначе за чужую подписку платил бы эксперт.
    const discountTiyn = isPremium
      ? Math.round((fullPriceTiyn * PREMIUM_DISCOUNT_BP) / 10_000)
      : 0;
    const amountTiyn = fullPriceTiyn - discountTiyn;
    const commissionRateBp = isPremium
      ? COMMISSION_BP_PREMIUM
      : COMMISSION_BP_REGULAR;
    const commissionTiyn = Math.round(
      (fullPriceTiyn * commissionRateBp) / 10_000,
    );

    const payment = await this.upsertPending(
      consultationId,
      consultation.clientUserId,
      consultation.expertId,
      method!.id,
      amountTiyn,
      commissionTiyn,
      discountTiyn,
      commissionRateBp,
    );

    // Ключ идемпотентности — на ПОПЫТКУ оплаты (holdAttempts инкрементится в
    // upsertPending), не на консультацию: после FAILED (например, банк снял
    // холд вебхуком) повторный pay обязан создать НОВЫЙ холд, а статичный
    // ключ вернул бы из идемпотентного кэша провайдера старый мёртвый.
    // Повтор ТОЙ ЖЕ попытки (сетевой ретрай) ключ по-прежнему дедуплицирует.
    const result = await this.provider.hold({
      idempotencyKey: `hold:${payment.id}:${payment.holdAttempts}`,
      token: method!.providerToken,
      amountTiyn,
    });

    if (result.status === 'declined') {
      // Оба зеркала статуса — атомарно: упади процесс между ними,
      // консультация навсегда осталась бы с paymentStatus PENDING.
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            failReason: result.declineReason ?? 'Банк отклонил операцию',
          },
        }),
        this.prisma.consultation.update({
          where: { id: consultationId },
          data: { paymentStatus: ConsultationPaymentStatus.FAILED },
        }),
      ]);

      await this.audit.log({
        actorType: 'user',
        actorId: userSub,
        entity: 'payment',
        entityId: payment.id,
        transition: 'payment.failed',
        payload: { consultationId, reason: result.declineReason },
      });

      this.events.emitToUser(
        consultation.clientUserId,
        'consultation.updated',
        {
          id: consultationId,
          paymentStatus: ConsultationPaymentStatus.FAILED,
        },
      );
      this.events.emitToExpert(consultation.expertId, 'consultation.updated', {
        id: consultationId,
        paymentStatus: ConsultationPaymentStatus.FAILED,
      });

      apiError(
        'PROVIDER_DECLINED',
        result.declineReason ?? 'Банк отклонил операцию',
        402,
      );
    }

    const now = this.clock.now();
    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.HELD,
          providerHoldId: result.providerHoldId,
          holdCreatedAt: now,
        },
      }),
      this.prisma.consultation.update({
        where: { id: consultationId },
        data: { paymentStatus: ConsultationPaymentStatus.HELD },
      }),
    ]);

    await this.audit.log({
      actorType: 'user',
      actorId: userSub,
      entity: 'payment',
      entityId: payment.id,
      transition: 'payment.held',
      payload: { consultationId, providerHoldId: result.providerHoldId },
    });

    this.events.emitToUser(consultation.clientUserId, 'consultation.updated', {
      id: consultationId,
      paymentStatus: ConsultationPaymentStatus.HELD,
    });
    this.events.emitToExpert(consultation.expertId, 'consultation.updated', {
      id: consultationId,
      paymentStatus: ConsultationPaymentStatus.HELD,
    });

    return { status: PaymentStatus.HELD };
  }

  // upsert по consultationId (@unique): P2002 на create -> уже существует
  // (гонка/повтор), обновляем ту же строку в PENDING с новыми
  // paymentMethodId/amount/commission (повтор после FAILED — восстановление
  // с новой картой той же записью). holdAttempts — номер попытки для ключа
  // идемпотентности hold (см. pay()).
  private async upsertPending(
    consultationId: string,
    clientUserId: string,
    expertId: string,
    paymentMethodId: string,
    amountTiyn: number,
    commissionTiyn: number,
    // Снимок Premium на момент оплаты: отмена подписки завтра не должна
    // пересчитывать вчерашний платёж.
    discountTiyn: number,
    commissionRateBp: number,
  ) {
    try {
      return await this.prisma.payment.create({
        data: {
          consultationId,
          clientUserId,
          expertId,
          paymentMethodId,
          amountTiyn,
          commissionTiyn,
          discountTiyn,
          commissionRateBp,
          status: PaymentStatus.PENDING,
          holdAttempts: 1,
        },
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        // Гейт по статусу: параллельный pay, проигравший гонку УЖЕ
        // захолдированной (или капчурнутой) записи, не должен сбрасывать её
        // в PENDING с чужой картой — updateMany с фильтром вместо слепого
        // update, count 0 в обеих ветках -> платёж уже в работе.
        //
        // holdAttempts инкрементится ТОЛЬКО на переходе FAILED -> PENDING
        // (прошлый холд мёртв, нужен новый ключ); гонка двух pay по
        // PENDING-строке сохраняет номер попытки — оба вызова идут к
        // провайдеру с ОДНИМ ключом, и холд ставится ровно один раз.
        const revived = await this.prisma.payment.updateMany({
          where: { consultationId, status: PaymentStatus.FAILED },
          data: {
            paymentMethodId,
            amountTiyn,
            commissionTiyn,
            discountTiyn,
            commissionRateBp,
            status: PaymentStatus.PENDING,
            failReason: null,
            holdAttempts: { increment: 1 },
          },
        });
        if (revived.count === 0) {
          const refreshed = await this.prisma.payment.updateMany({
            where: { consultationId, status: PaymentStatus.PENDING },
            data: {
              paymentMethodId,
              amountTiyn,
              commissionTiyn,
              discountTiyn,
              commissionRateBp,
            },
          });
          if (refreshed.count === 0) {
            apiError('ALREADY_PAID', 'Консультация уже оплачена', 409);
          }
        }
        return this.prisma.payment.findUniqueOrThrow({
          where: { consultationId },
        });
      }
      throw e;
    }
  }

  // GET /v1/consultations/:id/payment — только клиент-участник; эксперт
  // (или чужой) -> 404 CONSULTATION_NOT_FOUND (PII платежа клиента).
  async getStatus(
    consultationId: string,
    userSub: string,
  ): Promise<PaymentStatusDto> {
    const { role } = await this.consultations.resolveParticipant(
      consultationId,
      userSub,
    );
    if (role !== 'client') {
      apiError('CONSULTATION_NOT_FOUND', 'Консультация не найдена', 404);
    }

    const payment = await this.prisma.payment.findUnique({
      where: { consultationId },
    });
    if (!payment) {
      apiError('PAYMENT_NOT_FOUND', 'Платёж не найден', 404);
    }

    const method = await this.prisma.paymentMethod.findUnique({
      where: { id: payment!.paymentMethodId },
    });

    return {
      status: payment!.status,
      amountTiyn: payment!.amountTiyn,
      maskedPan: method?.maskedPan ?? '',
    };
  }

  // Вызывается из ConsultationsService.complete()/cancel() ПОСЛЕ фиксации
  // исхода, вне транзакции исхода, в try/catch на стороне вызывающего —
  // сбой settle никогда не должен откатывать исход консультации. Ветвится
  // по Payment.status; CAPTURED/VOIDED — no-op (идемпотентность повторного
  // вызова).
  async settle(consultationId: string): Promise<void> {
    const consultation = await this.prisma.consultation.findUniqueOrThrow({
      where: { id: consultationId },
    });
    const payment = await this.prisma.payment.findUnique({
      where: { consultationId },
    });

    if (!payment || payment.status === PaymentStatus.FAILED) {
      if (consultation.outcome === ConsultationOutcome.COMPLETED) {
        await this.audit.log({
          actorType: 'system',
          entity: 'payment',
          entityId: consultationId,
          transition: 'payment.missing_on_completion',
          payload: { consultationId },
        });
      }
      return;
    }

    if (
      payment.status === PaymentStatus.CAPTURED ||
      payment.status === PaymentStatus.VOIDED
    ) {
      return;
    }

    if (payment.status !== PaymentStatus.HELD) {
      // PENDING на завершённой консультации = pay() оборвался между
      // provider.hold и записью HELD (деньги могут быть заморожены у
      // провайдера без следа у нас) — sweep такие записи не подбирает,
      // оставляем хлебную крошку для ручного разбора.
      if (payment.status === PaymentStatus.PENDING) {
        await this.audit.log({
          actorType: 'system',
          entity: 'payment',
          entityId: payment.id,
          transition: 'payment.stuck_pending_on_settle',
          payload: { consultationId },
        });
      }
      return;
    }

    if (consultation.outcome === ConsultationOutcome.COMPLETED) {
      await this.captureAndCredit(payment, consultation.expertId);
    } else {
      await this.voidAndRelease(payment, consultation.outcome);
    }
  }

  private async captureAndCredit(
    payment: {
      id: string;
      consultationId: string;
      amountTiyn: number;
      commissionTiyn: number;
      discountTiyn: number;
      providerHoldId: string | null;
      clientUserId: string;
      expertId: string;
    },
    expertId: string,
  ): Promise<void> {
    await this.provider.capture({
      idempotencyKey: `capture:${payment.id}`,
      providerHoldId: payment.providerHoldId!,
      amountTiyn: payment.amountTiyn,
    });

    // Эксперт получает 85 % ПОЛНОЙ цены при любой ставке комиссии (Р-03),
    // поэтому его доля считается от полной цены по обычной ставке, а не от
    // того, что заплатил клиент. Полная цена восстанавливается как
    // «уплачено + скидка».
    //
    // Проводка сходится сама собой: скидка клиенту ровно равна тому, что
    // платформа недобрала комиссии (10 % = 15 % − 5 %), поэтому
    // amountTiyn = netTiyn + commissionTiyn и на Premium, и без него.
    const fullPriceTiyn = payment.amountTiyn + payment.discountTiyn;
    const netTiyn =
      fullPriceTiyn -
      Math.round((fullPriceTiyn * COMMISSION_BP_REGULAR) / 10_000);

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.CAPTURED },
      });
      await tx.consultation.update({
        where: { id: payment.consultationId },
        data: { paymentStatus: ConsultationPaymentStatus.CAPTURED },
      });
      await this.ledger.post(
        'capture',
        payment.id,
        [
          { account: ACC_ACQUIRER, debitTiyn: payment.amountTiyn },
          { account: expertAccount(expertId), creditTiyn: netTiyn },
          { account: ACC_COMMISSION, creditTiyn: payment.commissionTiyn },
        ],
        tx,
      );
    });

    await this.audit.log({
      actorType: 'system',
      entity: 'payment',
      entityId: payment.id,
      transition: 'payment.captured',
      payload: {
        amountTiyn: payment.amountTiyn,
        commissionTiyn: payment.commissionTiyn,
      },
    });

    this.events.emitToExpert(expertId, 'earning.credited', {
      consultationId: payment.consultationId,
      amountTiyn: netTiyn,
    });

    // Уведомление эксперту (E9, задача 6): dispatchToExpert сам никогда не
    // бросает (fire-and-forget) — сбой шины уведомлений не откатывает уже
    // зафиксированное начисление.
    await this.notifications.dispatchToExpert(expertId, 'earning.credited', {
      amountTiyn: netTiyn,
      amountTenge: formatTenge(netTiyn),
    });
  }

  private async voidAndRelease(
    payment: {
      id: string;
      consultationId: string;
      providerHoldId: string | null;
      clientUserId: string;
    },
    outcome: ConsultationOutcome,
  ): Promise<void> {
    await this.provider.void({
      idempotencyKey: `void:${payment.id}`,
      providerHoldId: payment.providerHoldId!,
    });

    // Атомарно, как в captureAndCredit: обрыв между двумя апдейтами оставил
    // бы консультацию с paymentStatus HELD навсегда (settle() ранним
    // return'ом на VOIDED зеркало не чинит).
    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.VOIDED },
      }),
      this.prisma.consultation.update({
        where: { id: payment.consultationId },
        data: { paymentStatus: ConsultationPaymentStatus.VOIDED },
      }),
    ]);

    await this.audit.log({
      actorType: 'system',
      entity: 'payment',
      entityId: payment.id,
      transition: 'payment.voided',
      payload: { outcome },
    });

    this.events.emitToUser(payment.clientUserId, 'consultation.updated', {
      id: payment.consultationId,
      paymentStatus: ConsultationPaymentStatus.VOIDED,
    });
  }

  // GET /v1/experts/me/earnings — список capture-начислений эксперта +
  // текущий баланс (из ledger). Пагинация take/skip, паттерн
  // ConsultationsService.list.
  async getEarnings(
    expertId: string,
    filters: ListEarningsDto,
  ): Promise<EarningsDto> {
    const take = Math.min(filters.take ?? DEFAULT_TAKE, MAX_TAKE);
    const skip = filters.skip ?? 0;

    const [balanceTiyn, payments] = await Promise.all([
      this.ledger.balanceTiyn(expertAccount(expertId)),
      this.prisma.payment.findMany({
        where: { expertId, status: PaymentStatus.CAPTURED },
        orderBy: { updatedAt: 'desc' },
        take,
        skip,
      }),
    ]);

    return {
      balanceTiyn,
      items: payments.map((p) => ({
        consultationId: p.consultationId,
        // Эксперту показывается ПОЛНАЯ цена и его 85 % от неё: чужая
        // Premium-скидка — расход платформы, в разбивке эксперта её нет.
        priceTiyn: p.amountTiyn + p.discountTiyn,
        // Эксперту показывается ЕГО удержание — всегда 15 % полной цены
        // (Р-02: «цена − 15 % = итого»). Ставка из Payment — это фактический
        // доход платформы: на Premium она берёт 5 %, доплачивая скидку
        // клиента из своих. К деньгам эксперта это отношения не имеет, и
        // разбивка у него обязана сходиться.
        commissionTiyn: Math.round(
          ((p.amountTiyn + p.discountTiyn) * COMMISSION_BP_REGULAR) / 10_000,
        ),
        netTiyn:
          p.amountTiyn +
          p.discountTiyn -
          Math.round(
            ((p.amountTiyn + p.discountTiyn) * COMMISSION_BP_REGULAR) / 10_000,
          ),
        createdAt: p.updatedAt,
      })),
    };
  }
}
