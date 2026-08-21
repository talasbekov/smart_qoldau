import {
  AdminRole,
  TicketAuthorType,
  TicketCategory,
  TicketTeam,
} from '@prisma/client';

// Чистые функции без зависимостей от Nest — легко тестировать юнитом,
// переиспользуются задачей 8 (очередь сотрудника фильтруется по team).

// Маршрутизация тикета в профильную команду по категории (Р-23, дословно):
// «эскалация тикетов категорий «Верификация», «Выплаты», «Безопасность» в
// профильные команды» — все прочие категории идут в общую поддержку.
export function routeCategory(category: TicketCategory): TicketTeam {
  switch (category) {
    case TicketCategory.VERIFICATION:
      return TicketTeam.VERIFICATION_OPERATOR;
    case TicketCategory.PAYOUTS:
      return TicketTeam.FINANCE_CONTROL;
    case TicketCategory.SECURITY:
      return TicketTeam.QUALITY_TEAM;
    default:
      return TicketTeam.SUPPORT_OPERATOR;
  }
}

// Категории обращения раздельны по типу автора (Global Constraints плана
// эпика E8a, задача 7). Эксперт видит экспертные категории (в т.ч.
// PAYOUTS/VERIFICATION/CLIENT_QUESTION), клиент и гость — одинаковый набор
// клиентских категорий (в т.ч. ACCOUNT_DATA/OTHER), без экспертных.
// Категория вне списка своего типа автора -> 400 TICKET_CATEGORY_NOT_ALLOWED
// (проверяется в TicketsService.create()).
// Соответствие профильной роли сотрудника её команде в очереди тикетов
// (задача 8). Значения AdminRole и TicketTeam совпадают дословно (см.
// комментарий у model Ticket в schema.prisma) — кроме SUPERADMIN, у которой
// нет своей команды: суперадмин видит все команды без ограничения (это
// решается на уровне TicketsService.adminList/canAccessTicketTeam, а не
// здесь).
const ROLE_TO_TEAM: Partial<Record<AdminRole, TicketTeam>> = {
  [AdminRole.VERIFICATION_OPERATOR]: TicketTeam.VERIFICATION_OPERATOR,
  [AdminRole.SUPPORT_OPERATOR]: TicketTeam.SUPPORT_OPERATOR,
  [AdminRole.FINANCE_CONTROL]: TicketTeam.FINANCE_CONTROL,
  [AdminRole.QUALITY_TEAM]: TicketTeam.QUALITY_TEAM,
};

// Команды сотрудника по его ролям. Несколько ролей -> объединение команд (без
// дублей) — сотрудник может состоять сразу в нескольких очередях. SUPERADMIN
// не даёт своей команды (обрабатывается отдельно в canAccessTicketTeam).
export function staffTeams(roles: AdminRole[]): TicketTeam[] {
  const teams = roles
    .map((role) => ROLE_TO_TEAM[role])
    .filter((team): team is TicketTeam => team !== undefined);
  return [...new Set(teams)];
}

// Доступ сотрудника к тикету конкретной команды: SUPERADMIN — всегда,
// остальные — только если team входит в их собственные команды.
export function canAccessTicketTeam(
  roles: AdminRole[],
  team: TicketTeam,
): boolean {
  return (
    roles.includes(AdminRole.SUPERADMIN) || staffTeams(roles).includes(team)
  );
}

export const CATEGORIES_BY_AUTHOR: Record<TicketAuthorType, TicketCategory[]> =
  {
    [TicketAuthorType.EXPERT]: [
      TicketCategory.CONSULTATIONS,
      TicketCategory.PAYMENT,
      TicketCategory.PAYOUTS,
      TicketCategory.TECHNICAL,
      TicketCategory.VERIFICATION,
      TicketCategory.SECURITY,
      TicketCategory.CLIENT_QUESTION,
    ],
    [TicketAuthorType.CLIENT]: [
      TicketCategory.CONSULTATIONS,
      TicketCategory.PAYMENT,
      TicketCategory.TECHNICAL,
      TicketCategory.ACCOUNT_DATA,
      TicketCategory.SECURITY,
      TicketCategory.OTHER,
    ],
    [TicketAuthorType.GUEST]: [
      TicketCategory.CONSULTATIONS,
      TicketCategory.PAYMENT,
      TicketCategory.TECHNICAL,
      TicketCategory.ACCOUNT_DATA,
      TicketCategory.SECURITY,
      TicketCategory.OTHER,
    ],
  };
