/// Список обращений клиента и создание новых.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/tickets_repository.dart';

/// Категории, доступные КЛИЕНТУ.
///
/// Ровно те, что разрешает бэкенд (`CATEGORIES_BY_AUTHOR` в
/// `backend/src/tickets/ticket-routing.ts`). Экспертные (`PAYOUTS`,
/// `VERIFICATION`, `CLIENT_QUESTION`) сюда не входят: показать их значило бы
/// повести человека в гарантированный `TICKET_CATEGORY_NOT_ALLOWED`.
const clientTicketCategories = <TicketCategory>[
  TicketCategory.consultations,
  TicketCategory.payment,
  TicketCategory.technical,
  TicketCategory.accountData,
  TicketCategory.security,
  TicketCategory.other,
];

class TicketsController extends AsyncNotifier<List<TicketSummary>> {
  @override
  FutureOr<List<TicketSummary>> build() =>
      ref.read(ticketsRepositoryProvider).list(take: 20, skip: 0);

  Future<void> refresh() async {
    state = await AsyncValue.guard(
      () => ref.read(ticketsRepositoryProvider).list(take: 20, skip: 0),
    );
  }

  /// Создаёт обращение и перечитывает список.
  ///
  /// Ошибку НЕ глотает: экран различает `TICKET_CATEGORY_NOT_ALLOWED`
  /// (значит, наш список категорий разошёлся с бэкендом) и обычный сбой.
  Future<void> create({
    required TicketCategory category,
    required String subject,
    required String body,
    String? relatedConsultationId,
  }) async {
    await ref
        .read(ticketsRepositoryProvider)
        .create(
          category: category,
          subject: subject,
          body: body,
          relatedConsultationId: relatedConsultationId,
        );
    await refresh();
  }
}

final ticketsControllerProvider =
    AsyncNotifierProvider<TicketsController, List<TicketSummary>>(
      TicketsController.new,
    );

/// Одно обращение с перепиской.
final ticketDetailProvider = FutureProvider.autoDispose
    .family<TicketDetail, String>(
      (ref, id) => ref.read(ticketsRepositoryProvider).byId(id),
    );
