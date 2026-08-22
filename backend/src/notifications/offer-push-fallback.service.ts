import { Inject, Injectable, Logger } from '@nestjs/common';
import { CandidateResponse, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClockService } from '../common/clock/clock.service';
import { AuditService } from '../audit/audit.service';
import { SMS_PROVIDER_TOKEN, SmsProvider } from '../auth/sms/sms.provider';
import { CRITICAL_TYPES } from './notification-templates';
import { SmsBudgetService } from './sms-budget.service';

// SMS-добивка критичного пуша (E9, задача 5, §11.6): если за 10с эксперт не
// подтвердил доставку пуша (POST /v1/notifications/:id/ack) — ровно ОДНО SMS
// на его телефон, но только если оффер по data.offerId ЕЩЁ PENDING (иначе
// SMS опоздало бы — оффер уже принят/отклонён/просрочен/отозван, и
// smsFallbackAt проставляется без отправки). Вызывается 8-м шагом
// OfferTimerService.sweep() (собственный try/catch — сбой не должен мешать
// остальным шагам). Батч ≤100 за тик — как в SettleRetryService/NoShowService.
//
// Область действия — CRITICAL_TYPES (сейчас только offer.incoming), см.
// комментарий в notification-templates.ts: только критичные типы получают
// SMS-fallback.
//
// Идемпотентность: гейт smsFallbackAt: null в WHERE updateMany — второй/
// параллельный sweep той же записи не пройдёт дальше claim'а (паттерн
// noShowNotifiedAt в NoShowService).
const FALLBACK_DELAY_MS = 10_000;
const SWEEP_BATCH = 100;
const SMS_TEXT = 'SmartQoldau: новая заявка, откройте приложение';

@Injectable()
export class OfferPushFallbackService {
  private readonly logger = new Logger(OfferPushFallbackService.name);

  constructor(
    private prisma: PrismaService,
    private clock: ClockService,
    private audit: AuditService,
    @Inject(SMS_PROVIDER_TOKEN) private sms: SmsProvider,
    private budget: SmsBudgetService,
  ) {}

  // Возвращает число обработанных записей — для единообразия с другими
  // sweep-сервисами (SettleRetryService.sweep и т.д.).
  async sweep(): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - FALLBACK_DELAY_MS);

    const candidates = await this.prisma.notification.findMany({
      where: {
        type: { in: Array.from(CRITICAL_TYPES) },
        pushDeliveredAt: null,
        smsFallbackAt: null,
        createdAt: { lte: cutoff },
      },
      take: SWEEP_BATCH,
    });
    if (candidates.length === 0) return 0;

    let processed = 0;
    for (const notification of candidates) {
      try {
        await this.fallbackOne(notification);
        processed++;
      } catch (e) {
        this.logger.error(
          `sms fallback failed for notification ${notification.id}: ${
            e instanceof Error ? e.message : String(e)
          }`,
          e instanceof Error ? e.stack : undefined,
        );
      }
    }
    return processed;
  }

  private async fallbackOne(notification: {
    id: string;
    userId: string;
    data: Prisma.JsonValue;
  }): Promise<void> {
    const now = this.clock.now();

    // Claim ПЕРВЫМ (идемпотентность), офферный статус проверяем СВЕЖИМ уже
    // после claim'а.
    const claimed = await this.prisma.notification.updateMany({
      where: { id: notification.id, smsFallbackAt: null },
      data: { smsFallbackAt: now },
    });
    if (claimed.count === 0) return;

    const offerId = this.extractOfferId(notification.data);
    const offer = offerId
      ? await this.prisma.requestCandidate.findUnique({
          where: { id: offerId },
        })
      : null;

    if (offer?.response !== CandidateResponse.PENDING) {
      // Оффер уже не PENDING — SMS опоздало бы, smsFallbackAt уже проставлен
      // выше, добивать эксперта не нужно.
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: notification.userId },
      select: { phone: true },
    });
    if (!user?.phone) {
      this.logger.warn(
        `SMS-fallback уведомления ${notification.id}: у пользователя ${notification.userId} нет телефона`,
      );
      return;
    }

    // Бюджет проверяется ПОСЛЕ всех остальных условий: списывать лимит на
    // уведомление, которое всё равно не ушло бы (оффер уже не PENDING, у
    // пользователя нет телефона), значило бы обкрадывать тех, кому SMS
    // действительно нужно.
    const decision = await this.budget.explainConsume(notification.userId);
    if (!decision.allowed) {
      // Отказ бюджета НЕ должен выглядеть как доставка: smsFallbackAt уже
      // проставлен (окно fallback закрыто), поэтому различие фиксируется в
      // audit отдельным переходом с названием сработавшего предела.
      await this.audit.log({
        actorType: 'system',
        entity: 'notification',
        entityId: notification.id,
        transition: 'notification.sms_budget_exceeded',
        payload: { offerId, limit: decision.limit },
      });
      return;
    }

    await this.sms.send(user.phone, SMS_TEXT);

    await this.audit.log({
      actorType: 'system',
      entity: 'notification',
      entityId: notification.id,
      transition: 'notification.sms_fallback',
      payload: { offerId },
    });
  }

  private extractOfferId(data: Prisma.JsonValue): string | undefined {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const offerId = (data as Record<string, unknown>).offerId;
      if (typeof offerId === 'string') return offerId;
    }
    return undefined;
  }
}
