import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { apiError } from '../common/filters/app-exception.filter';
import {
  toClientCard,
  visibleConsultations,
  type ClientCard,
  type ConsultationRow,
} from './clients';

export type ClientDetail = ClientCard & {
  history: {
    id: string;
    startedAt: Date | null;
    endedAt: Date | null;
    status: string;
    topicSlug: string;
    hasNote: boolean;
  }[];
};

@Injectable()
export class ExpertClientsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // Список людей, с которыми эксперт работал И которые согласились быть
  // видимыми (Р-27). Несогласившиеся не попадают сюда вовсе — не «без
  // имени», а не попадают.
  async list(expertId: string): Promise<ClientCard[]> {
    const consultations = await this.prisma.consultation.findMany({
      where: { expertId },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        status: true,
        clientUserId: true,
        topic: { select: { slug: true } },
      },
    });

    const clientIds = [...new Set(consultations.map((c) => c.clientUserId))];
    if (clientIds.length === 0) return [];

    const clients = await this.prisma.user.findMany({
      where: {
        id: { in: clientIds },
        expertVisibilityAcceptedAt: { not: null },
        deletedAt: null,
      },
      select: { id: true, displayName: true, expertVisibilityAcceptedAt: true },
    });

    return (
      clients
        .map((client) => {
          const rows: ConsultationRow[] = consultations
            .filter((c) => c.clientUserId === client.id)
            .map((c) => ({
              id: c.id,
              startedAt: c.startedAt,
              endedAt: c.endedAt,
              status: c.status,
              topicSlug: c.topic?.slug ?? '',
            }));

          const visible = visibleConsultations(
            rows,
            client.expertVisibilityAcceptedAt,
          );
          return { client, visible };
        })
        // Клиент, у которого после согласия ещё не было встреч, в списке не
        // нужен: показывать нечего, а имя без истории — лишние данные.
        .filter(({ visible }) => visible.length > 0)
        .map(({ client, visible }) =>
          toClientCard(
            { id: client.id, displayName: client.displayName, phone: null },
            visible,
          ),
        )
        .sort((a, b) => (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0))
    );
  }

  async detail(expertId: string, clientUserId: string): Promise<ClientDetail> {
    const client = await this.prisma.user.findFirst({
      where: {
        id: clientUserId,
        expertVisibilityAcceptedAt: { not: null },
        deletedAt: null,
      },
      select: { id: true, displayName: true, expertVisibilityAcceptedAt: true },
    });
    if (!client) apiError('CLIENT_NOT_FOUND', 'Клиент не найден', 404);

    const consultations = await this.prisma.consultation.findMany({
      where: { expertId, clientUserId },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        status: true,
        topic: { select: { slug: true } },
        // Текст заметки НЕ достаём: он зашифрован, и расшифровывать их
        // пачкой значит продублировать путь чтения вместе с его
        // правилами доступа. Показываем, что заметка есть, а сама она
        // открывается в консультации, где и живёт.
        note: { select: { consultationId: true } },
      },
      orderBy: { startedAt: 'desc' },
    });

    const rows: ConsultationRow[] = consultations.map((c) => ({
      id: c.id,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      status: c.status,
      topicSlug: c.topic?.slug ?? '',
    }));
    const visible = visibleConsultations(
      rows,
      client.expertVisibilityAcceptedAt,
    );
    if (visible.length === 0)
      apiError('CLIENT_NOT_FOUND', 'Клиент не найден', 404);

    // Данные стали чувствительнее — доступ к ним должен быть виден.
    // Тот же приём, что у журнала доступа к метаданным консультаций
    // (ТЗ §11.7): без записи невозможно ответить, кто и когда смотрел.
    await this.audit.log({
      actorType: 'expert',
      actorId: expertId,
      entity: 'client',
      entityId: clientUserId,
      transition: 'client.card_read',
      payload: { consultations: visible.length },
    });

    const visibleIds = new Set(visible.map((v) => v.id));
    return {
      ...toClientCard(
        { id: client.id, displayName: client.displayName, phone: null },
        visible,
      ),
      history: consultations
        .filter((c) => visibleIds.has(c.id))
        .map((c) => ({
          id: c.id,
          startedAt: c.startedAt,
          endedAt: c.endedAt,
          status: c.status,
          topicSlug: c.topic?.slug ?? '',
          hasNote: c.note !== null,
        })),
    };
  }
}
