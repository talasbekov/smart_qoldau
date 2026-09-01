// Поддержка для эксперта (E14). Прототип мобильного эксперта содержит
// экран «Поддержка», а в продукте его не было: тикеты (E8a) заводились
// только клиентом, и психологу было некуда написать из приложения.
// Бэкенд при этом экспертные категории поддерживает давно.
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/support/data/tickets_repository.dart';
import 'package:app_expert/features/support/state/tickets_controller.dart';

void main() {
  test('категории ровно те, что разрешает бэкенд эксперту', () {
    // Список зеркалит CATEGORIES_BY_AUTHOR[EXPERT] в
    // backend/src/tickets/ticket-routing.ts.
    expect(expertTicketCategories, [
      TicketCategory.consultations,
      TicketCategory.payment,
      TicketCategory.payouts,
      TicketCategory.technical,
      TicketCategory.verification,
      TicketCategory.security,
      TicketCategory.clientQuestion,
    ]);
  });

  test('клиентских категорий эксперту не показываем', () {
    // ACCOUNT_DATA и OTHER бэкенд эксперту запрещает: показать их значило
    // бы повести человека в гарантированный TICKET_CATEGORY_NOT_ALLOWED.
    expect(expertTicketCategories, isNot(contains(TicketCategory.accountData)));
    expect(expertTicketCategories, isNot(contains(TicketCategory.other)));
  });

  test('проводные значения совпадают с enum бэкенда', () {
    expect(ticketCategoryWire(TicketCategory.payouts), 'PAYOUTS');
    expect(
      ticketCategoryWire(TicketCategory.clientQuestion),
      'CLIENT_QUESTION',
    );
    expect(ticketCategoryWire(TicketCategory.verification), 'VERIFICATION');
  });
}
