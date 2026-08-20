import { Injectable } from '@nestjs/common';
import {
  ConsultationOutcome,
  ConsultationStatus,
  Prisma,
  Review,
  ReviewStatus,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConsultationsService } from '../consultations/consultations.service';
import { ExpertsService } from '../experts/experts.service';
import { apiError } from '../common/filters/app-exception.filter';
import { CreateReviewDto } from './dto/create-review.dto';
import { ListExpertReviewsDto } from './dto/list-expert-reviews.dto';
import { ExpertReviewsDto } from './dto/expert-reviews.dto';
import { ReviewCreatedDto } from './dto/review-created.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { ComplaintReviewDto } from './dto/complaint-review.dto';
import { ResolveReviewDto } from './dto/resolve-review.dto';
import { FlaggedReviewDto } from './dto/flagged-review.dto';

const DEFAULT_TAKE = 20;
const MAX_TAKE = 100;

// Р-20: порог качества эксперта. Решение по упрощению из брифа задачи 7:
// audit-флаг фиксируется КАЖДЫЙ раз, когда после пересчёта агрегатов условие
// (ratingCount >= 20 && ratingAvg < 4.0) выполняется — не только на пересечении
// порога вниз. Это самая простая и предсказуемая реализация: даунстрим
// (админ-панель задачи 8) может дедуплицировать по времени, если понадобится
// не заваливать очередь повторными одинаковыми флагами.
const RATING_THRESHOLD_COUNT = 20;
const RATING_THRESHOLD_AVG = 4.0;

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private consultations: ConsultationsService,
    private experts: ExpertsService,
  ) {}

  // Клиент оставляет отзыв на завершённую консультацию (COMPLETED +
  // outcome COMPLETED). Один отзыв на консультацию (Review.consultationId
  // @unique) — повторная попытка -> 409 REVIEW_EXISTS (ловим P2002, а не
  // делаем предварительный findUnique — защита от гонки двух параллельных
  // POST одного клиента).
  async create(
    consultationId: string,
    userSub: string,
    dto: CreateReviewDto,
  ): Promise<ReviewCreatedDto> {
    const { consultation, role } = await this.consultations.resolveParticipant(
      consultationId,
      userSub,
    );
    if (role !== 'client')
      apiError('FORBIDDEN', 'Только клиент может оставить отзыв', 403);

    if (
      consultation.status !== ConsultationStatus.COMPLETED ||
      consultation.outcome !== ConsultationOutcome.COMPLETED
    )
      apiError(
        'CONSULTATION_NOT_COMPLETED',
        'Отзыв можно оставить только на завершённую консультацию',
        409,
      );

    let review: Review;
    try {
      review = await this.prisma.$transaction(async (tx) => {
        await this.lockExpertRow(tx, consultation.expertId);
        const created = await tx.review.create({
          data: {
            consultationId,
            clientUserId: userSub,
            expertId: consultation.expertId,
            rating: dto.rating,
            publicText: dto.publicText,
            privateText: dto.privateText,
          },
        });
        await this.recalcExpertRating(tx, consultation.expertId);
        return created;
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002')
        apiError('REVIEW_EXISTS', 'Отзыв уже оставлен', 409);
      throw e;
    }

    await this.audit.log({
      actorType: 'user',
      actorId: userSub,
      entity: 'review',
      entityId: review.id,
      transition: 'review.created',
      payload: {
        consultationId,
        expertId: consultation.expertId,
        rating: dto.rating,
      },
    });

    await this.checkRatingThreshold(consultation.expertId);

    return {
      id: review.id,
      consultationId: review.consultationId,
      rating: review.rating,
      publicText: review.publicText,
      createdAt: review.createdAt,
    };
  }

  // Удаление отзыва автором-клиентом. Чужой отзыв -> 404 REVIEW_NOT_FOUND
  // (не раскрываем существование чужого отзыва).
  async remove(reviewId: string, userSub: string): Promise<void> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review || review.clientUserId !== userSub)
      apiError('REVIEW_NOT_FOUND', 'Отзыв не найден', 404);

    await this.prisma.$transaction(async (tx) => {
      await this.lockExpertRow(tx, review!.expertId);
      await tx.review.delete({ where: { id: reviewId } });
      await this.recalcExpertRating(tx, review!.expertId);
    });

    await this.audit.log({
      actorType: 'user',
      actorId: userSub,
      entity: 'review',
      entityId: reviewId,
      transition: 'review.deleted',
      payload: { expertId: review!.expertId },
    });
  }

  // Найти отзыв и проверить, что вызывающий — эксперт, о котором этот
  // отзыв. Чужой эксперт/не-эксперт/несуществующий отзыв -> 404
  // REVIEW_NOT_FOUND (не раскрываем существование чужого отзыва).
  private async findOwnReviewOrThrow(
    reviewId: string,
    userSub: string,
  ): Promise<Review> {
    const expert = await this.experts.findByUserId(userSub);
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review || !expert || review.expertId !== expert.id)
      apiError('REVIEW_NOT_FOUND', 'Отзыв не найден', 404);
    return review!;
  }

  // Ответ эксперта на отзыв о себе. Разрешён только для PUBLISHED —
  // FLAGGED/HIDDEN -> 409 (сначала разбор жалобы/модерация). Повторный
  // reply перезаписывает предыдущий текст.
  async reply(
    reviewId: string,
    userSub: string,
    dto: ReplyReviewDto,
  ): Promise<void> {
    const review = await this.findOwnReviewOrThrow(reviewId, userSub);

    if (review.status !== ReviewStatus.PUBLISHED)
      apiError(
        'INVALID_STATE_TRANSITION',
        'Ответ можно оставить только на опубликованный отзыв',
        409,
      );

    await this.prisma.review.update({
      where: { id: reviewId },
      data: { expertReply: dto.text },
    });

    await this.audit.log({
      actorType: 'expert',
      actorId: userSub,
      entity: 'review',
      entityId: reviewId,
      transition: 'review.replied',
    });
  }

  // Жалоба эксперта на отзыв о себе: PUBLISHED -> FLAGGED (+ текст жалобы).
  // Отзыв временно выпадает из публичной выдачи и агрегатов рейтинга —
  // пересчёт делаем В ТРАНЗАКЦИИ сразу (recalcExpertRating считает только
  // PUBLISHED, поэтому FLAGGED автоматически исключается). Повторная жалоба
  // на уже FLAGGED-отзыв -> 409.
  async complaint(
    reviewId: string,
    userSub: string,
    dto: ComplaintReviewDto,
  ): Promise<void> {
    const review = await this.findOwnReviewOrThrow(reviewId, userSub);

    if (review.status !== ReviewStatus.PUBLISHED)
      apiError(
        'INVALID_STATE_TRANSITION',
        'Жалобу можно подать только на опубликованный отзыв',
        409,
      );

    await this.prisma.$transaction(async (tx) => {
      await this.lockExpertRow(tx, review.expertId);
      await tx.review.update({
        where: { id: reviewId },
        data: { status: ReviewStatus.FLAGGED, complaint: dto.text },
      });
      await this.recalcExpertRating(tx, review.expertId);
    });

    await this.audit.log({
      actorType: 'expert',
      actorId: userSub,
      entity: 'review',
      entityId: reviewId,
      transition: 'review.flagged',
    });
  }

  // Админ: список FLAGGED-отзывов для разбора — видит ВСЁ, включая
  // privateText (обычно скрытый от эксперта/публики).
  async listFlagged(): Promise<FlaggedReviewDto[]> {
    const reviews = await this.prisma.review.findMany({
      where: { status: ReviewStatus.FLAGGED },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        expertId: true,
        rating: true,
        publicText: true,
        privateText: true,
        complaint: true,
        createdAt: true,
      },
    });
    return reviews;
  }

  // Админ-решение по FLAGGED-отзыву: hide -> HIDDEN (остаётся вне выдачи
  // и агрегатов), restore -> PUBLISHED (возврат в публичную выдачу и
  // агрегаты). В обоих случаях пересчёт в той же транзакции. Не-FLAGGED
  // отзыв -> 409 INVALID_STATE_TRANSITION.
  async resolve(reviewId: string, dto: ResolveReviewDto): Promise<void> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
    });
    if (!review) apiError('REVIEW_NOT_FOUND', 'Отзыв не найден', 404);
    if (review!.status !== ReviewStatus.FLAGGED)
      apiError(
        'INVALID_STATE_TRANSITION',
        'Разрешить можно только отзыв в статусе FLAGGED',
        409,
      );

    const newStatus =
      dto.action === 'hide' ? ReviewStatus.HIDDEN : ReviewStatus.PUBLISHED;

    await this.prisma.$transaction(async (tx) => {
      await this.lockExpertRow(tx, review!.expertId);
      await tx.review.update({
        where: { id: reviewId },
        data: { status: newStatus },
      });
      await this.recalcExpertRating(tx, review!.expertId);
    });

    await this.audit.log({
      actorType: 'admin',
      entity: 'review',
      entityId: reviewId,
      transition: dto.action === 'hide' ? 'review.hidden' : 'review.restored',
      payload: { comment: dto.comment },
    });
  }

  // Публичная выдача отзывов эксперта: только PUBLISHED, полная анонимность
  // автора (ни id, ни clientCode), privateText никогда не попадает в ответ.
  async listForExpert(
    expertId: string,
    filters: ListExpertReviewsDto,
  ): Promise<ExpertReviewsDto> {
    const take = Math.min(filters.take ?? DEFAULT_TAKE, MAX_TAKE);
    const skip = filters.skip ?? 0;

    const [reviews, grouped, expert] = await Promise.all([
      this.prisma.review.findMany({
        where: { expertId, status: ReviewStatus.PUBLISHED },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: {
          rating: true,
          publicText: true,
          expertReply: true,
          createdAt: true,
        },
      }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: { expertId, status: ReviewStatus.PUBLISHED },
        _count: true,
      }),
      this.prisma.expert.findUniqueOrThrow({ where: { id: expertId } }),
    ]);

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const g of grouped) {
      if (g.rating >= 1 && g.rating <= 5)
        distribution[g.rating as 1 | 2 | 3 | 4 | 5] = g._count;
    }

    return {
      items: reviews,
      distribution,
      ratingAvg: expert.ratingAvg,
      ratingCount: expert.ratingCount,
    };
  }

  // Pessimistic row-lock строки эксперта (SELECT ... FOR UPDATE). Сама по
  // себе транзакция на уровне ReadCommitted НЕ защищает пересчёт: два
  // параллельных create отзывов разным консультациям одного эксперта видят
  // снимки без чужой (ещё не закоммиченной) вставки, и второй записал бы
  // устаревшие агрегаты. FOR UPDATE сериализует такие транзакции по одному
  // эксперту: вторая блокируется на этой строке до коммита первой, после
  // чего её aggregate уже видит закоммиченную вставку/удаление. Вызывать
  // ПЕРВЫМ действием транзакции — до create/delete отзыва.
  private async lockExpertRow(
    tx: Prisma.TransactionClient,
    expertId: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM experts WHERE id = ${expertId} FOR UPDATE`;
  }

  // Пересчёт агрегатов эксперта агрегатом по PUBLISHED-отзывам. Вызывается
  // ВНУТРИ транзакции create/remove ПОСЛЕ lockExpertRow — корректность при
  // конкурентных пересчётах по одному эксперту обеспечивает именно row-lock
  // (см. lockExpertRow), а не изоляция транзакции. round до 2 знаков.
  private async recalcExpertRating(
    tx: Prisma.TransactionClient,
    expertId: string,
  ): Promise<void> {
    const agg = await tx.review.aggregate({
      where: { expertId, status: ReviewStatus.PUBLISHED },
      _avg: { rating: true },
      _count: true,
    });
    const ratingAvg = agg._avg.rating
      ? Math.round(agg._avg.rating * 100) / 100
      : 0;
    const ratingCount = agg._count;

    await tx.expert.update({
      where: { id: expertId },
      data: { ratingAvg, ratingCount },
    });
  }

  // Р-20: после коммита транзакции — если у эксперта накопилось достаточно
  // отзывов и средний рейтинг ниже порога, фиксируем audit-флаг для
  // последующего разбора командой качества (админ-API задачи 8).
  private async checkRatingThreshold(expertId: string): Promise<void> {
    const expert = await this.prisma.expert.findUniqueOrThrow({
      where: { id: expertId },
    });
    if (
      expert.ratingCount >= RATING_THRESHOLD_COUNT &&
      expert.ratingAvg < RATING_THRESHOLD_AVG
    ) {
      await this.audit.log({
        actorType: 'system',
        entity: 'expert',
        entityId: expertId,
        transition: 'expert.rating_below_threshold',
        payload: { avg: expert.ratingAvg, count: expert.ratingCount },
      });
    }
  }
}
