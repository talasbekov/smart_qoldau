import { HttpException } from '@nestjs/common';
import { AdminRole, TicketStatus, TicketTeam } from '@prisma/client';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClockService } from '../common/clock/clock.service';
import { ExpertsService } from '../experts/experts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CurrentAdminPayload } from '../admin/current-admin.decorator';

// Юнит на гонку reply() против resolve() (финальное ревью E8a, п.4, вторая
// волна): в реальной БД её через e2e не воспроизвести детерминированно
// (Jest e2e работает в один процесс, maxWorkers: 1), поэтому мокаем Prisma и
// проверяем ИМЕННО последовательность вызовов внутри транзакции — условный
// updateMany с двумя условиями (firstReplyAt: null И status: not RESOLVED),
// и что при count === 0 сервис различает "уже есть первый ответ" от "тикет
// решили конкурентно" отдельным чтением, а не откатывает статус вслепую.

const NOW = new Date('2026-08-22T05:00:00Z');
const TICKET_ID = 'ticket-1';

const ADMIN: CurrentAdminPayload = {
  id: 'admin-1',
  roles: [AdminRole.SUPPORT_OPERATOR],
};

function buildService(opts: {
  firstReplyCount: number;
  currentStatusIfRechecked?: TicketStatus;
}) {
  const ticketMessageCreate = jest.fn().mockResolvedValue({ id: 'msg-1' });
  const ticketUpdateMany = jest
    .fn()
    .mockResolvedValue({ count: opts.firstReplyCount });
  const ticketFindUniqueOrThrow = jest
    .fn()
    .mockResolvedValue({ status: opts.currentStatusIfRechecked });

  const tx = {
    ticket: {
      updateMany: ticketUpdateMany,
      findUniqueOrThrow: ticketFindUniqueOrThrow,
    },
    ticketMessage: { create: ticketMessageCreate },
  };

  const prisma = {
    ticket: {
      // findAccessibleOrThrow(): читает тикет ДО открытия транзакции —
      // на этот момент тикет ещё не решён (иначе сработал бы pre-check в
      // reply() и транзакция вообще не открылась бы).
      findUnique: jest.fn().mockResolvedValue({
        id: TICKET_ID,
        status: TicketStatus.NEW,
        team: TicketTeam.SUPPORT_OPERATOR,
        authorUserId: null,
        messages: [],
      }),
    },
    $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
  };

  const audit = { log: jest.fn() };
  const clock = { now: () => NOW };
  const notifications = { dispatch: jest.fn() };

  const service = new TicketsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
    clock as unknown as ClockService,
    {} as unknown as ExpertsService,
    notifications as unknown as NotificationsService,
  );

  return {
    service,
    audit,
    ticketMessageCreate,
    ticketUpdateMany,
    ticketFindUniqueOrThrow,
  };
}

describe('TicketsService.reply — гонка с resolve()', () => {
  it('resolve() успел закоммититься между пред-проверкой и условным updateMany (count=0, статус при доп. чтении уже RESOLVED) -> 409 TICKET_ALREADY_RESOLVED, сообщение НЕ вставляется', async () => {
    const { service, ticketMessageCreate, ticketFindUniqueOrThrow } =
      buildService({
        firstReplyCount: 0,
        currentStatusIfRechecked: TicketStatus.RESOLVED,
      });

    try {
      await service.reply(ADMIN, TICKET_ID, 'Опоздавший ответ');
      fail('ожидалось исключение');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      expect((e as HttpException).getStatus()).toBe(409);
      expect((e as HttpException).getResponse()).toEqual({
        code: 'TICKET_ALREADY_RESOLVED',
        message: expect.any(String),
      });
    }

    expect(ticketFindUniqueOrThrow).toHaveBeenCalled();
    // Главная гарантия фикса: сообщение не должно попасть в БД, если тикет
    // оказался решён к моменту вставки — иначе получаем несогласованное
    // состояние (RESOLVED + новое сообщение) или откат статуса.
    expect(ticketMessageCreate).not.toHaveBeenCalled();
  });

  it('count=0, но при доп. чтении тикет всё ещё открыт (IN_PROGRESS) -> легитимный повторный ответ: сообщение вставляется, firstReply=false, статус/firstReplyAt повторно не пишутся', async () => {
    const { service, audit, ticketMessageCreate, ticketUpdateMany } =
      buildService({
        firstReplyCount: 0,
        currentStatusIfRechecked: TicketStatus.IN_PROGRESS,
      });

    await service.reply(ADMIN, TICKET_ID, 'Ещё один ответ');

    expect(ticketMessageCreate).toHaveBeenCalledTimes(1);
    // Статус и firstReplyAt пишутся ОДНИМ условным updateMany с условием на
    // оба поля — без отдельного безусловного апдейта статуса.
    expect(ticketUpdateMany).toHaveBeenCalledWith({
      where: {
        id: TICKET_ID,
        status: { not: TicketStatus.RESOLVED },
        firstReplyAt: null,
      },
      data: { status: TicketStatus.IN_PROGRESS, firstReplyAt: NOW },
    });
    // Второй updateMany — автоназначение (E11a, задача 8). Условие
    // `assignedToId: null` не даёт перехватить тикет, уже взятый коллегой.
    expect(ticketUpdateMany).toHaveBeenCalledWith({
      where: { id: TICKET_ID, assignedToId: null },
      data: { assignedToId: ADMIN.id },
    });
    expect(ticketUpdateMany).toHaveBeenCalledTimes(2);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { firstReply: false } }),
    );
  });

  it('первый ответ выигрывает условный updateMany (count=1) -> сообщение вставляется без доп. чтения статуса, firstReply=true', async () => {
    const { service, audit, ticketMessageCreate, ticketFindUniqueOrThrow } =
      buildService({ firstReplyCount: 1 });

    await service.reply(ADMIN, TICKET_ID, 'Первый ответ');

    expect(ticketFindUniqueOrThrow).not.toHaveBeenCalled();
    expect(ticketMessageCreate).toHaveBeenCalledTimes(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { firstReply: true } }),
    );
  });
});
