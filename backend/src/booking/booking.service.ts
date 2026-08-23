import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import {
  ConsultationPaymentStatus,
  ConsultationStatus,
  RequestStatus,
  VerificationStatus,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { EventsService } from '../ws/events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentsService } from '../payments/payments.service';
import { apiError } from '../common/filters/app-exception.filter';
import { SlotsService } from './slots.service';
import { BookingResultDto, CreateBookingDto } from './dto/create-booking.dto';
import {
  HORIZON_DAYS,
  LEAD_MINUTES,
  SESSION_MINUTES,
} from './booking.constants';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private prisma: PrismaService,
    private slots: SlotsService,
    private payments: PaymentsService,
    private audit: AuditService,
    private clock: ClockService,
    private events: EventsService,
    private notifications: NotificationsService,
  ) {}

  async create(
    userSub: string,
    dto: CreateBookingDto,
  ): Promise<{ result: BookingResultDto; created: boolean }> {
    const slotStartAt = new Date(dto.slotStartAt);
    const now = this.clock.now();

    if (
      slotStartAt.getTime() < now.getTime() + LEAD_MINUTES * MS_PER_MINUTE ||
      slotStartAt.getTime() > now.getTime() + HORIZON_DAYS * MS_PER_DAY
    ) {
      apiError(
        'SLOT_OUT_OF_RANGE',
        `Записаться можно не раньше чем через ${LEAD_MINUTES} минут и не дальше чем на ${HORIZON_DAYS} дней`,
        400,
      );
    }

    const expert = await this.prisma.expert.findUnique({
      where: { id: dto.expertId },
      include: { topics: { include: { topic: true } } },
    });
    // Заблокированный и непроверенный неотличимы от несуществующего.
    if (
      !expert ||
      expert.isBlocked ||
      expert.verificationStatus !== VerificationStatus.VERIFIED
    ) {
      apiError('EXPERT_NOT_FOUND', 'Эксперт не найден', 404);
    }
    if (
      !expert.formats.includes(dto.format) ||
      !expert.topics.some((t) => t.topic.slug === dto.topicSlug)
    ) {
      apiError(
        'EXPERT_TOPIC_MISMATCH',
        'Специалист не работает с этой темой или в этом формате',
        400,
      );
    }

    const topic = await this.prisma.topic.findUnique({
      where: { slug: dto.topicSlug },
    });
    if (!topic) apiError('TOPIC_NOT_FOUND', 'Тема не найдена', 404);

    // Идемпотентность: повторный запрос того же клиента на тот же слот
    // возвращает прежнюю запись и НЕ делает второго холда.
    const existing = await this.prisma.consultation.findFirst({
      where: {
        expertId: dto.expertId,
        clientUserId: userSub,
        startedAt: slotStartAt,
        status: ConsultationStatus.SCHEDULED,
      },
    });
    if (existing) {
      return {
        created: false,
        result: {
          consultationId: existing.id,
          startedAt: existing.startedAt.toISOString(),
          status: existing.status,
          paymentStatus: existing.paymentStatus,
        },
      };
    }

    // Слот должен принадлежать расписанию: занятость перепроверит база.
    const free = await this.slots.freeSlots(
      dto.expertId,
      slotStartAt,
      new Date(slotStartAt.getTime() + SESSION_MINUTES * MS_PER_MINUTE),
    );
    if (!free.some((s) => s.getTime() === slotStartAt.getTime())) {
      const taken = await this.prisma.consultation.findFirst({
        where: {
          expertId: dto.expertId,
          startedAt: slotStartAt,
          status: {
            in: [ConsultationStatus.SCHEDULED, ConsultationStatus.ACTIVE],
          },
        },
      });
      if (taken) apiError('SLOT_TAKEN', 'Это время уже занято', 409);
      apiError('SLOT_UNAVAILABLE', 'Слот недоступен', 409);
    }

    const clientCode = randomInt(1000, 10000);
    const consultation = await this.prisma
      .$transaction(async (tx) => {
        // Запись порождает закрытую заявку: так сохраняется clientCode и
        // единый путь `Consultation.requestId`, на который опирается E4/E5.
        const request = await tx.request.create({
          data: {
            clientUserId: userSub,
            clientCode,
            topicId: topic.id,
            format: dto.format,
            directedExpertId: dto.expertId,
            matchedExpertId: dto.expertId,
            status: RequestStatus.MATCHED,
            closedAt: now,
          },
        });
        return tx.consultation.create({
          data: {
            requestId: request.id,
            clientUserId: userSub,
            clientCode,
            expertId: dto.expertId,
            topicId: topic.id,
            format: dto.format,
            priceTiyn: expert.priceTiyn,
            status: ConsultationStatus.SCHEDULED,
            startedAt: slotStartAt,
          },
        });
      })
      .catch((e) => {
        // Гонку ловит частичный уникальный индекс по (expert_id,
        // started_at) — единственная надёжная защита под нагрузкой.
        if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
          apiError('SLOT_TAKEN', 'Это время уже занято', 409);
        }
        throw e;
      });

    // Холд — сразу за созданием: запись без успешного холда не остаётся
    // (Р-01), поэтому отказ банка откатывает консультацию.
    try {
      await this.payments.pay(consultation.id, userSub, dto.paymentMethodId);
    } catch (e) {
      await this.rollback(consultation.id);
      throw e;
    }

    const held = await this.prisma.consultation.findUniqueOrThrow({
      where: { id: consultation.id },
    });

    await this.audit.log({
      actorType: 'user',
      actorId: userSub,
      entity: 'consultation',
      entityId: consultation.id,
      transition: 'consultation.booked',
      payload: { expertId: dto.expertId, slotStartAt: dto.slotStartAt },
    });

    // Уведомление без темы обращения — PII-правило E9.
    await this.notifications.dispatchToExpert(
      dto.expertId,
      'consultation.booked',
      { consultationId: consultation.id, startAt: dto.slotStartAt },
    );
    this.events.emitToExpert(dto.expertId, 'consultation.created', {
      id: consultation.id,
      status: held.status,
      startedAt: held.startedAt.toISOString(),
    });

    return {
      created: true,
      result: {
        consultationId: held.id,
        startedAt: held.startedAt.toISOString(),
        status: held.status,
        paymentStatus: held.paymentStatus,
      },
    };
  }

  /// Откат несостоявшейся записи: слот обязан снова стать свободным, а
  /// частичный уникальный индекс покрывает только SCHEDULED и ACTIVE,
  /// поэтому достаточно перевести запись в CANCELLED.
  private async rollback(consultationId: string): Promise<void> {
    try {
      await this.prisma.consultation.update({
        where: { id: consultationId },
        data: {
          status: ConsultationStatus.CANCELLED,
          paymentStatus: ConsultationPaymentStatus.FAILED,
          endedAt: this.clock.now(),
        },
      });
    } catch (e) {
      this.logger.error(
        `не удалось откатить запись ${consultationId}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }
}
