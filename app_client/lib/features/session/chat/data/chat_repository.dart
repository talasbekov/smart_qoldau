/// История переписки консультации и её состояние — фасад над `SqApi`.
///
/// Отправка сообщений сюда НЕ входит: у бэкенда нет HTTP-эндпоинта отправки,
/// сообщение уходит только событием `chat.send` через шину (см.
/// `EventsGateway.handleChatSend`).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../../core/providers.dart';

class ChatRepository {
  const ChatRepository(this._api);

  final SqApi _api;

  /// `GET /v1/consultations/{id}/messages` — страница истории.
  ///
  /// Листание идёт ВПЕРЁД: [cursor] — id последнего сообщения предыдущей
  /// страницы, следующая страница содержит сообщения ПОЗЖЕ него
  /// (`ChatService.history`: `orderBy createdAt asc`, `createdAt > cursor`).
  Future<MessageHistory> history(
    String consultationId, {
    String? cursor,
    int limit = 50,
  }) => _api.consultationMessages(consultationId, cursor: cursor, limit: limit);

  /// `GET /v1/consultations/{id}` — консультация (статус, время старта,
  /// плановая длительность, специалист).
  Future<ClientConsultation> consultation(String id) =>
      _api.consultationById(id);

  /// `POST /v1/consultations/{id}/cancel` — отмена консультации клиентом.
  Future<ClientConsultation> cancel(String id) => _api.cancelConsultation(id);
}

final chatRepositoryProvider = Provider<ChatRepository>(
  (ref) => ChatRepository(ref.watch(sqApiProvider)),
);
