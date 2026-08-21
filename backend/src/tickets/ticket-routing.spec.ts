import { TicketAuthorType, TicketCategory, TicketTeam } from '@prisma/client';
import { CATEGORIES_BY_AUTHOR, routeCategory } from './ticket-routing';

describe('Маршрутизация тикетов (юнит, E8a §Р-23)', () => {
  it('VERIFICATION -> VERIFICATION_OPERATOR', () => {
    expect(routeCategory(TicketCategory.VERIFICATION)).toBe(
      TicketTeam.VERIFICATION_OPERATOR,
    );
  });

  it('PAYOUTS -> FINANCE_CONTROL', () => {
    expect(routeCategory(TicketCategory.PAYOUTS)).toBe(
      TicketTeam.FINANCE_CONTROL,
    );
  });

  it('SECURITY -> QUALITY_TEAM', () => {
    expect(routeCategory(TicketCategory.SECURITY)).toBe(
      TicketTeam.QUALITY_TEAM,
    );
  });

  it('все прочие категории -> SUPPORT_OPERATOR', () => {
    const rest = [
      TicketCategory.CONSULTATIONS,
      TicketCategory.PAYMENT,
      TicketCategory.TECHNICAL,
      TicketCategory.CLIENT_QUESTION,
      TicketCategory.ACCOUNT_DATA,
      TicketCategory.OTHER,
    ];
    for (const category of rest) {
      expect(routeCategory(category)).toBe(TicketTeam.SUPPORT_OPERATOR);
    }
  });

  it('каждая из девяти категорий даёт ожидаемую команду (полное покрытие enum)', () => {
    const expected: Record<TicketCategory, TicketTeam> = {
      VERIFICATION: TicketTeam.VERIFICATION_OPERATOR,
      PAYOUTS: TicketTeam.FINANCE_CONTROL,
      SECURITY: TicketTeam.QUALITY_TEAM,
      CONSULTATIONS: TicketTeam.SUPPORT_OPERATOR,
      PAYMENT: TicketTeam.SUPPORT_OPERATOR,
      TECHNICAL: TicketTeam.SUPPORT_OPERATOR,
      CLIENT_QUESTION: TicketTeam.SUPPORT_OPERATOR,
      ACCOUNT_DATA: TicketTeam.SUPPORT_OPERATOR,
      OTHER: TicketTeam.SUPPORT_OPERATOR,
    };
    for (const category of Object.values(TicketCategory)) {
      expect(routeCategory(category)).toBe(expected[category]);
    }
  });

  it('у клиента и гостя одинаковый набор категорий, без экспертных', () => {
    expect(CATEGORIES_BY_AUTHOR[TicketAuthorType.CLIENT]).toEqual(
      CATEGORIES_BY_AUTHOR[TicketAuthorType.GUEST],
    );
    for (const forbidden of [
      TicketCategory.VERIFICATION,
      TicketCategory.PAYOUTS,
      TicketCategory.CLIENT_QUESTION,
    ]) {
      expect(CATEGORIES_BY_AUTHOR[TicketAuthorType.CLIENT]).not.toContain(
        forbidden,
      );
      expect(CATEGORIES_BY_AUTHOR[TicketAuthorType.GUEST]).not.toContain(
        forbidden,
      );
    }
  });

  it('у эксперта есть экспертные категории, но нет ACCOUNT_DATA/OTHER', () => {
    for (const allowed of [
      TicketCategory.PAYOUTS,
      TicketCategory.VERIFICATION,
      TicketCategory.CLIENT_QUESTION,
    ]) {
      expect(CATEGORIES_BY_AUTHOR[TicketAuthorType.EXPERT]).toContain(allowed);
    }
    for (const forbidden of [
      TicketCategory.ACCOUNT_DATA,
      TicketCategory.OTHER,
    ]) {
      expect(CATEGORIES_BY_AUTHOR[TicketAuthorType.EXPERT]).not.toContain(
        forbidden,
      );
    }
  });

  it('CATEGORIES_BY_AUTHOR покрывает все три типа автора и все категории существуют в TicketCategory', () => {
    for (const authorType of Object.values(TicketAuthorType)) {
      const categories = CATEGORIES_BY_AUTHOR[authorType];
      expect(categories.length).toBeGreaterThan(0);
      for (const c of categories) {
        expect(Object.values(TicketCategory)).toContain(c);
      }
    }
  });
});
