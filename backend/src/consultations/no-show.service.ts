import { Injectable, Logger } from '@nestjs/common';
import { ConsultationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { EventsService } from '../ws/events.service';
import { NotificationsService } from '../notifications/notifications.service';

const NO_SHOW_THRESHOLD_MS = 180_000;

// Р-13/E4: клиент не подключился к аудио/видео-консультации в течение 3
// минут после старта. Мы НЕ завершаем консультацию автоматически — решение
// (complete outcome=CLIENT_NO_SHOW либо ждать дальше) остаётся за экспертом;
// sweep() только один раз проставляет noShowNotifiedAt и уведомляет эксперта
// WS-хинтом, чтобы UI показал баннер "клиент не подключился".
// Идемпотентность per-строчно: гейт noShowNotifiedAt: null в WHERE — второй
// sweep той же консультации не находит её снова, дубля audit/WS не будет,
// даже если между findMany и updateMany конкурентный sweep успел обновить.
@Injectable()
export class NoShowService {
  private readonly logger = new Logger(NoShowService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private clock: ClockService,
    private events: EventsService,
    private notifications: NotificationsService,
  ) {}

  async sweep(): Promise<void> {
    const cutoff = new Date(this.clock.now().getTime() - NO_SHOW_THRESHOLD_MS);

    const candidates = await this.prisma.consultation.findMany({
      where: {
        status: ConsultationStatus.ACTIVE,
        format: { in: ['audio', 'video'] },
        startedAt: { lte: cutoff },
        clientJoinedAt: null,
        noShowNotifiedAt: null,
      },
    });

    // Пакетный lookup userId по expertId (E9, задача 6) — одним запросом на
    // всю пачку sweep-кандидатов, как в escalation.service.ts (задача 5).
    const expertUsers = await this.prisma.expert.findMany({
      where: { id: { in: candidates.map((c) => c.expertId) } },
      select: { id: true, userId: true },
    });
    const userIdByExpertId = new Map(expertUsers.map((e) => [e.id, e.userId]));

    for (const consultation of candidates) {
      const now = this.clock.now();
      // Гейт noShowNotifiedAt: null повторно в updateMany — защищает от
      // гонки с параллельным sweep между findMany и этим updateMany.
      const result = await this.prisma.consultation.updateMany({
        where: { id: consultation.id, noShowNotifiedAt: null },
        data: { noShowNotifiedAt: now },
      });
      if (result.count === 0) continue;

      await this.audit.log({
        actorType: 'system',
        entity: 'consultation',
        entityId: consultation.id,
        transition: 'consultation.client_no_show_hint',
      });

      this.events.emitToExpert(
        consultation.expertId,
        'consultation.client_no_show_hint',
        { consultationId: consultation.id },
      );

      // In-app + push (E9, задача 6): dispatch() сам никогда не бросает
      // (fire-and-forget) — сбой шины уведомлений не откатывает уже
      // проставленный noShowNotifiedAt.
      const userId = userIdByExpertId.get(consultation.expertId);
      if (userId) {
        await this.notifications.dispatch(userId, 'consultation.no_show_hint', {
          consultationId: consultation.id,
        });
      }
    }
  }
}
