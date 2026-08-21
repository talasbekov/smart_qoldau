import { Injectable } from '@nestjs/common';
import { Ticket, TicketAuthorType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { ExpertsService } from '../experts/experts.service';
import { apiError } from '../common/filters/app-exception.filter';
import { JwtPayload } from '../auth/jwt.strategy';
import { CATEGORIES_BY_AUTHOR, routeCategory } from './ticket-routing';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import {
  TicketCreatedDto,
  TicketDetailDto,
  TicketSummaryDto,
} from './dto/ticket.dto';

const DEFAULT_TAKE = 20;
const MAX_TAKE = 100;

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
      messages: ticket!.messages.map((m) => ({
        id: m.id,
        authorKind: m.authorKind,
        body: m.body,
        createdAt: m.createdAt,
      })),
    };
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
