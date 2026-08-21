import { Injectable } from '@nestjs/common';
import {
  AdminRole,
  Prisma,
  Ticket,
  TicketAuthorType,
  TicketStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { ExpertsService } from '../experts/experts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { apiError } from '../common/filters/app-exception.filter';
import { JwtPayload } from '../auth/jwt.strategy';
import { CurrentAdminPayload } from '../admin/current-admin.decorator';
import {
  CATEGORIES_BY_AUTHOR,
  canAccessTicketTeam,
  routeCategory,
  staffTeams,
} from './ticket-routing';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { AdminListTicketsDto } from './dto/admin-list-tickets.dto';
import {
  AdminTicketDetailDto,
  TicketCreatedDto,
  TicketDetailDto,
  TicketSummaryDto,
} from './dto/ticket.dto';

const DEFAULT_TAKE = 20;
const MAX_TAKE = 100;

type TicketWithMessages = Prisma.TicketGetPayload<{
  include: { messages: true };
}>;

interface ResolvedAuthor {
  authorType: TicketAuthorType;
  authorUserId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private clock: ClockService,
    private experts: ExpertsService,
    private notifications: NotificationsService,
  ) {}

  // POST /v1/tickets. JWT необязателен (OptionalJwtAuthGuard):
  // - с токеном тип автора определяет СЕРВЕР по аккаунту (эксперт, если у
  //   пользователя есть Expert, иначе клиент) — из тела запроса тип автора
  //   никогда не берётся, иначе клиент мог бы объявить себя экспертом и
  //   получить доступ к экспертным категориям;
  // - без токена — GUEST, обязателен contactEmail/contactPhone в теле.
  async create(
    dto: CreateTicketDto,
    user: JwtPayload | null,
  ): Promise<TicketCreatedDto> {
    const author = await this.resolveAuthor(dto, user);

    if (!CATEGORIES_BY_AUTHOR[author.authorType].includes(dto.category))
      apiError(
        'TICKET_CATEGORY_NOT_ALLOWED',
        'Эта категория недоступна для вашего типа обращения',
        400,
      );

    const team = routeCategory(dto.category);

    const ticket = await this.prisma.ticket.create({
      data: {
        authorType: author.authorType,
        authorUserId: author.authorUserId,
        contactEmail: author.contactEmail,
        contactPhone: author.contactPhone,
        category: dto.category,
        subject: dto.subject,
        body: dto.body,
        team,
        relatedConsultationId: dto.relatedConsultationId ?? null,
        relatedPayoutId: dto.relatedPayoutId ?? null,
        // Явно из ClockService (а не @default(now()) БД) — иначе виртуальное
        // время в e2e не подчиняет момент создания тикета (урок E9, см.
        // NotificationsService.dispatchOrThrow / RequestsService.create).
        createdAt: this.clock.now(),
      },
    });

    await this.audit.log({
      actorType: author.authorUserId ? 'user' : 'system',
      actorId: author.authorUserId,
      entity: 'ticket',
      entityId: ticket.id,
      transition: 'ticket.created',
      payload: { category: dto.category, team, authorType: author.authorType },
    });

    return {
      id: ticket.id,
      status: ticket.status,
      category: ticket.category,
      team: ticket.team,
      createdAt: ticket.createdAt,
    };
  }

  // GET /v1/tickets — свои обращения, новые сверху. Вторичный ключ id в
  // orderBy — createdAt может совпасть у тикетов, созданных в одну и ту же
  // миллисекунду (тот же паттерн, что и в NotificationsService.list /
  // ReviewsService.listForExpert).
  async list(
    userId: string,
    filters: ListTicketsDto,
  ): Promise<TicketSummaryDto[]> {
    const take = Math.min(filters.take ?? DEFAULT_TAKE, MAX_TAKE);
    const skip = filters.skip ?? 0;

    const tickets = await this.prisma.ticket.findMany({
      where: { authorUserId: userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
    });

    return tickets.map((t) => this.toSummary(t));
  }

  // GET /v1/tickets/:id — своё обращение с перепиской. Чужое/несуществующее
  // -> 404 TICKET_NOT_FOUND (не раскрываем существование чужого тикета).
  async getOwn(userId: string, id: string): Promise<TicketDetailDto> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!ticket || ticket.authorUserId !== userId)
      apiError('TICKET_NOT_FOUND', 'Обращение не найдено', 404);

    return {
      ...this.toSummary(ticket!),
      body: ticket!.body,
      firstReplyAt: ticket!.firstReplyAt,
      resolvedAt: ticket!.resolvedAt,
      relatedConsultationId: ticket!.relatedConsultationId,
      relatedPayoutId: ticket!.relatedPayoutId,
      messages: this.toMessages(ticket!.messages),
    };
  }

  // GET /v1/admin/tickets?status&team&take&skip — очередь сотрудника (задача
  // 8). SUPERADMIN видит все команды без ограничения; остальные — только
  // тикеты своих команд (staffTeams по ролям сотрудника, объединение при
  // нескольких ролях). Явный фильтр team за пределами своих команд -> пустой
  // список (не 403 — очередь чужой команды просто пуста для этого сотрудника).
  async adminList(
    admin: CurrentAdminPayload,
    filters: AdminListTicketsDto,
  ): Promise<TicketSummaryDto[]> {
    const take = Math.min(filters.take ?? DEFAULT_TAKE, MAX_TAKE);
    const skip = filters.skip ?? 0;
    const isSuperadmin = admin.roles.includes(AdminRole.SUPERADMIN);
    const ownTeams = staffTeams(admin.roles);

    const where: Prisma.TicketWhereInput = {};
    if (filters.status) where.status = filters.status;

    if (filters.team) {
      if (!isSuperadmin && !ownTeams.includes(filters.team)) return [];
      where.team = filters.team;
    } else if (!isSuperadmin) {
      where.team = { in: ownTeams };
    }

    const tickets = await this.prisma.ticket.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      skip,
    });

    return tickets.map((t) => this.toSummary(t));
  }

  // GET /v1/admin/tickets/:id — карточка сотрудника: та же переписка, что и
  // у автора, плюс данные автора (authorType/authorUserId/contact*).
  // Тикет чужой команды -> 404 TICKET_NOT_FOUND (не 403 — не раскрываем даже
  // факт существования тикета вне доступных сотруднику команд). Каждый
  // просмотр пишет audit ticket.viewed_by_staff.
  async adminGet(
    admin: CurrentAdminPayload,
    id: string,
  ): Promise<AdminTicketDetailDto> {
    const ticket = await this.findAccessibleOrThrow(admin, id);

    await this.audit.log({
      actorType: 'admin',
      actorId: admin.id,
      entity: 'ticket',
      entityId: ticket.id,
      transition: 'ticket.viewed_by_staff',
      payload: { ticketId: ticket.id, authorUserId: ticket.authorUserId },
    });

    return {
      ...this.toSummary(ticket),
      body: ticket.body,
      firstReplyAt: ticket.firstReplyAt,
      resolvedAt: ticket.resolvedAt,
      relatedConsultationId: ticket.relatedConsultationId,
      relatedPayoutId: ticket.relatedPayoutId,
      authorType: ticket.authorType,
      authorUserId: ticket.authorUserId,
      contactEmail: ticket.contactEmail,
      contactPhone: ticket.contactPhone,
      messages: this.toMessages(ticket.messages),
    };
  }

  // POST /v1/admin/tickets/:id/reply — сообщение сотрудника. Первый ответ
  // проставляет firstReplyAt и переводит NEW -> IN_PROGRESS; повторные ответы
  // идемпотентны — firstReplyAt НЕ сдвигается (условное ?? поверх уже
  // сохранённого значения), IN_PROGRESS не откатывается назад. Тикет в
  // RESOLVED -> 409 TICKET_ALREADY_RESOLVED (решённый тикет не переоткрывается
  // ответом).
  async reply(
    admin: CurrentAdminPayload,
    id: string,
    body: string,
  ): Promise<void> {
    const ticket = await this.findAccessibleOrThrow(admin, id);
    if (ticket.status === TicketStatus.RESOLVED)
      apiError('TICKET_ALREADY_RESOLVED', 'Обращение уже решено', 409);

    const now = this.clock.now();
    const isFirstReply = ticket.firstReplyAt === null;

    await this.prisma.$transaction([
      this.prisma.ticketMessage.create({
        data: {
          ticketId: id,
          authorKind: 'staff',
          authorId: admin.id,
          body,
          createdAt: now,
        },
      }),
      this.prisma.ticket.update({
        where: { id },
        data: {
          status:
            ticket.status === TicketStatus.NEW
              ? TicketStatus.IN_PROGRESS
              : ticket.status,
          firstReplyAt: ticket.firstReplyAt ?? now,
        },
      }),
    ]);

    await this.audit.log({
      actorType: 'admin',
      actorId: admin.id,
      entity: 'ticket',
      entityId: id,
      transition: 'ticket.replied',
      payload: { firstReply: isFirstReply },
    });

    // In-app + push (E9): dispatch() сам никогда не бросает (fire-and-forget) —
    // сбой шины уведомлений не откатывает уже сохранённый ответ сотрудника.
    // Текст ответа в уведомление НЕ кладём (приватность, как в chat.message) —
    // только subject тикета. У гостевого тикета (authorType GUEST)
    // authorUserId нет — уведомление не отправляется.
    if (ticket.authorUserId) {
      await this.notifications.dispatch(ticket.authorUserId, 'ticket.replied', {
        ticketId: id,
        subject: ticket.subject,
      });
    }
  }

  // POST /v1/admin/tickets/:id/resolve — решение тикета сотрудником.
  // Повторный вызов на уже решённом тикете -> 409 TICKET_ALREADY_RESOLVED.
  async resolve(admin: CurrentAdminPayload, id: string): Promise<void> {
    const ticket = await this.findAccessibleOrThrow(admin, id);
    if (ticket.status === TicketStatus.RESOLVED)
      apiError('TICKET_ALREADY_RESOLVED', 'Обращение уже решено', 409);

    await this.prisma.ticket.update({
      where: { id },
      data: { status: TicketStatus.RESOLVED, resolvedAt: this.clock.now() },
    });

    await this.audit.log({
      actorType: 'admin',
      actorId: admin.id,
      entity: 'ticket',
      entityId: id,
      transition: 'ticket.resolved',
    });
  }

  // Общая проверка для adminGet/reply/resolve: тикет не найден ИЛИ его
  // команда недоступна сотруднику (не одна из его ролей и не SUPERADMIN) ->
  // 404 TICKET_NOT_FOUND в обоих случаях — сотрудник не должен различать
  // "тикета не существует" и "тикет есть, но не моей команды".
  private async findAccessibleOrThrow(
    admin: CurrentAdminPayload,
    id: string,
  ): Promise<TicketWithMessages> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!ticket || !canAccessTicketTeam(admin.roles, ticket.team))
      apiError('TICKET_NOT_FOUND', 'Обращение не найдено', 404);
    return ticket!;
  }

  private toMessages(messages: TicketWithMessages['messages']) {
    return messages.map((m) => ({
      id: m.id,
      authorKind: m.authorKind,
      body: m.body,
      createdAt: m.createdAt,
    }));
  }

  private toSummary(ticket: Ticket): TicketSummaryDto {
    return {
      id: ticket.id,
      category: ticket.category,
      subject: ticket.subject,
      status: ticket.status,
      team: ticket.team,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }

  // Без токена -> GUEST, контакт обязателен (хотя бы одно из полей).
  // С токеном -> тип автора СЕРВЕР определяет по аккаунту, контакт берётся
  // из аккаунта (User.phone), а не из тела запроса — авторизованный автор не
  // может подменить свой контакт присланным в body значением.
  private async resolveAuthor(
    dto: CreateTicketDto,
    user: JwtPayload | null,
  ): Promise<ResolvedAuthor> {
    if (!user) {
      if (!dto.contactEmail && !dto.contactPhone)
        apiError(
          'TICKET_CONTACT_REQUIRED',
          'Укажите email или телефон для связи',
          400,
        );
      return {
        authorType: TicketAuthorType.GUEST,
        authorUserId: null,
        contactEmail: dto.contactEmail ?? null,
        contactPhone: dto.contactPhone ?? null,
      };
    }

    const [account, expert] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { phone: true },
      }),
      this.experts.findByUserId(user.sub),
    ]);

    return {
      authorType: expert ? TicketAuthorType.EXPERT : TicketAuthorType.CLIENT,
      authorUserId: user.sub,
      contactEmail: null,
      contactPhone: account?.phone ?? null,
    };
  }
}
