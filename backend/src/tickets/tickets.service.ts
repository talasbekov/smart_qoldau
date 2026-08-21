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
  AdminTicketsListDto,
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
  // {items, total} (финальное ревью E8a, п.8) — как в admin-staff.service.ts:
  // count() той же выборки без take/skip, параллельно с findMany.
  async adminList(
    admin: CurrentAdminPayload,
    filters: AdminListTicketsDto,
  ): Promise<AdminTicketsListDto> {
    const take = Math.min(filters.take ?? DEFAULT_TAKE, MAX_TAKE);
    const skip = filters.skip ?? 0;
    const isSuperadmin = admin.roles.includes(AdminRole.SUPERADMIN);
    const ownTeams = staffTeams(admin.roles);

    const where: Prisma.TicketWhereInput = {};
    if (filters.status) where.status = filters.status;

    if (filters.team) {
      if (!isSuperadmin && !ownTeams.includes(filters.team))
        return { items: [], total: 0 };
      where.team = filters.team;
    } else if (!isSuperadmin) {
      where.team = { in: ownTeams };
    }

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        skip,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return { items: tickets.map((t) => this.toSummary(t)), total };
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
  // идемпотентны — firstReplyAt НЕ сдвигается, IN_PROGRESS не откатывается
  // назад. Тикет в RESOLVED -> 409 TICKET_ALREADY_RESOLVED (решённый тикет не
  // переоткрывается ответом, сообщение не создаётся).
  //
  // firstReplyAt/status проставляются условным updateMany с ДВУМЯ условиями
  // в WHERE — firstReplyAt: null И status: not RESOLVED (финальное ревью
  // E8a, п.4, вторая волна): одного firstReplyAt: null было недостаточно —
  // если resolve() коммитится между предварительной проверкой ниже и этим
  // updateMany, апдейт всё ещё видел бы firstReplyAt: null и откатывал бы
  // status обратно в IN_PROGRESS поверх уже проставленного resolvedAt,
  // оставляя недостижимую по стейт-машине комбинацию. count === 0 теперь
  // двусмыслен: либо firstReplyAt уже стоит (легитимный повторный ответ),
  // либо тикет успели решить конкурентно (должно дать 409). Разводим ПОСЛЕ
  // updateMany обычным чтением статуса — это НЕ гонка: Postgres блокирует
  // наш UPDATE, пока не закоммитится любая конкурентная транзакция над той
  // же строкой (в т.ч. resolve()), и переоценивает WHERE против её
  // результата — так что к моменту, когда updateMany вернул count, любое
  // конкурентное изменение уже видно. RESOLVED к тому же терминален (нет
  // перехода назад), поэтому и обратной гонки на этом чтении быть не может.
  // Тот же паттерн "victory by count", что approve()/reject() в
  // payouts.service.ts и resolve() ниже.
  async reply(
    admin: CurrentAdminPayload,
    id: string,
    body: string,
  ): Promise<void> {
    const ticket = await this.findAccessibleOrThrow(admin, id);
    if (ticket.status === TicketStatus.RESOLVED)
      apiError('TICKET_ALREADY_RESOLVED', 'Обращение уже решено', 409);

    const now = this.clock.now();

    const isFirstReply = await this.prisma.$transaction(async (tx) => {
      const firstReply = await tx.ticket.updateMany({
        where: {
          id,
          status: { not: TicketStatus.RESOLVED },
          firstReplyAt: null,
        },
        data: { status: TicketStatus.IN_PROGRESS, firstReplyAt: now },
      });

      if (firstReply.count === 0) {
        const current = await tx.ticket.findUniqueOrThrow({
          where: { id },
          select: { status: true },
        });
        if (current.status === TicketStatus.RESOLVED) {
          apiError('TICKET_ALREADY_RESOLVED', 'Обращение уже решено', 409);
        }
      }

      await tx.ticketMessage.create({
        data: {
          ticketId: id,
          authorKind: 'staff',
          authorId: admin.id,
          body,
          createdAt: now,
        },
      });

      return firstReply.count > 0;
    });

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
    // Ни текст ответа, ни subject тикета в уведомление НЕ кладём (ревью:
    // subject — немодерируемый пользовательский текст, который на платформе
    // психологической поддержки может быть чувствительным, а push рендерится
    // на заблокированном экране) — только ticketId, чтобы открыть нужное
    // обращение внутри приложения. У гостевого тикета (authorType GUEST)
    // authorUserId нет — уведомление не отправляется.
    if (ticket.authorUserId) {
      await this.notifications.dispatch(ticket.authorUserId, 'ticket.replied', {
        ticketId: id,
      });
    }
  }

  // POST /v1/admin/tickets/:id/resolve — решение тикета сотрудником.
  // Повторный вызов на уже решённом тикете -> 409 TICKET_ALREADY_RESOLVED.
  //
  // updateMany с фильтром по текущему статусу (не check-then-act update) —
  // тот же паттерн, что approve()/reject() в payouts.service.ts, «победит
  // ровно один»: двое операторов, одновременно нажавших «Решить» на одном
  // тикете, иначе оба получили бы 200 и resolvedAt перезаписался бы вторым
  // (финальное ревью E8a, п.4).
  async resolve(admin: CurrentAdminPayload, id: string): Promise<void> {
    await this.findAccessibleOrThrow(admin, id);

    const resolved = await this.prisma.ticket.updateMany({
      where: { id, status: { not: TicketStatus.RESOLVED } },
      data: { status: TicketStatus.RESOLVED, resolvedAt: this.clock.now() },
    });
    if (resolved.count === 0) {
      apiError('TICKET_ALREADY_RESOLVED', 'Обращение уже решено', 409);
    }

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
