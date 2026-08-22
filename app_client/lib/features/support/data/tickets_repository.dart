/// Обращения в поддержку.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/providers.dart';

/// Проводные значения категорий (`TicketCategory` бэкенда).
String ticketCategoryWire(TicketCategory category) => switch (category) {
  TicketCategory.consultations => 'CONSULTATIONS',
  TicketCategory.payment => 'PAYMENT',
  TicketCategory.payouts => 'PAYOUTS',
  TicketCategory.technical => 'TECHNICAL',
  TicketCategory.verification => 'VERIFICATION',
  TicketCategory.security => 'SECURITY',
  TicketCategory.clientQuestion => 'CLIENT_QUESTION',
  TicketCategory.accountData => 'ACCOUNT_DATA',
  TicketCategory.other => 'OTHER',
};

class TicketsRepository {
  const TicketsRepository(this._api);

  final SqApi _api;

  /// `GET /v1/tickets` — свои обращения.
  Future<List<TicketSummary>> list({int? take, int? skip}) =>
      _api.tickets(take: take, skip: skip);

  /// `GET /v1/tickets/{id}` — обращение с перепиской.
  Future<TicketDetail> byId(String id) => _api.ticketById(id);

  /// `POST /v1/tickets` — создать обращение.
  Future<void> create({
    required TicketCategory category,
    required String subject,
    required String body,
    String? relatedConsultationId,
  }) => _api.createTicket(
    category: ticketCategoryWire(category),
    subject: subject,
    body: body,
    relatedConsultationId: relatedConsultationId,
  );
}

final ticketsRepositoryProvider = Provider<TicketsRepository>(
  (ref) => TicketsRepository(ref.watch(sqApiProvider)),
);
