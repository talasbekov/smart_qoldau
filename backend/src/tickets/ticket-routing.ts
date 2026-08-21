import { TicketAuthorType, TicketCategory, TicketTeam } from '@prisma/client';

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
