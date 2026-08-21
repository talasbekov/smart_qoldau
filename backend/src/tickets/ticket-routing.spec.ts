import {
  AdminRole,
  TicketAuthorType,
  TicketCategory,
  TicketTeam,
} from '@prisma/client';
import {
  CATEGORIES_BY_AUTHOR,
  canAccessTicketTeam,
  routeCategory,
  staffTeams,
} from './ticket-routing';

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

describe('staffTeams/canAccessTicketTeam (юнит, задача 8: очередь тикетов)', () => {
  it('одна профильная роль -> одна команда', () => {
    expect(staffTeams([AdminRole.SUPPORT_OPERATOR])).toEqual([
      TicketTeam.SUPPORT_OPERATOR,
    ]);
    expect(staffTeams([AdminRole.FINANCE_CONTROL])).toEqual([
      TicketTeam.FINANCE_CONTROL,
    ]);
  });

  it('несколько ролей -> объединение команд без дублей', () => {
    expect(
      staffTeams([
        AdminRole.SUPPORT_OPERATOR,
        AdminRole.FINANCE_CONTROL,
        AdminRole.SUPPORT_OPERATOR,
      ]),
    ).toEqual([TicketTeam.SUPPORT_OPERATOR, TicketTeam.FINANCE_CONTROL]);
  });

  it('SUPERADMIN не даёт собственной команды в staffTeams', () => {
    expect(staffTeams([AdminRole.SUPERADMIN])).toEqual([]);
    expect(staffTeams([AdminRole.SUPERADMIN, AdminRole.QUALITY_TEAM])).toEqual([
      TicketTeam.QUALITY_TEAM,
    ]);
  });

  it('canAccessTicketTeam: SUPERADMIN проходит для любой команды', () => {
    for (const team of Object.values(TicketTeam)) {
      expect(canAccessTicketTeam([AdminRole.SUPERADMIN], team)).toBe(true);
    }
  });

  it('canAccessTicketTeam: своя команда -> true, чужая -> false', () => {
    const roles = [AdminRole.SUPPORT_OPERATOR, AdminRole.FINANCE_CONTROL];
    expect(canAccessTicketTeam(roles, TicketTeam.SUPPORT_OPERATOR)).toBe(true);
    expect(canAccessTicketTeam(roles, TicketTeam.FINANCE_CONTROL)).toBe(true);
    expect(canAccessTicketTeam(roles, TicketTeam.QUALITY_TEAM)).toBe(false);
    expect(canAccessTicketTeam(roles, TicketTeam.VERIFICATION_OPERATOR)).toBe(
      false,
    );
  });

  it('canAccessTicketTeam: пустой список ролей -> false для любой команды', () => {
    for (const team of Object.values(TicketTeam)) {
      expect(canAccessTicketTeam([], team)).toBe(false);
    }
  });
});
