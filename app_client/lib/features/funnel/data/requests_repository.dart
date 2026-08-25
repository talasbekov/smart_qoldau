/// Доступ к заявкам на подбор эксперта и счётчику доступных онлайн — тонкий
/// фасад над `SqApi` (по образцу `TopicsRepository` задачи 7), чтобы
/// контроллеры воронки занимались только состоянием.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';


class RequestsRepository {
  const RequestsRepository(this._api);

  final SqApi _api;

  /// `POST /v1/requests` — создать заявку. [expertId] задаётся только для
  /// адресной заявки из каталога (задача 16 эпика E6).
  Future<MatchRequest> create({
    required String topicSlug,
    required SessionFormat format,
    bool isEmergency = false,
    String? expertId,
  }) => _api.createRequest(
    topicSlug: topicSlug,
    format: format,
    isEmergency: isEmergency,
    expertId: expertId,
  );

  /// `GET /v1/requests/{id}` — текущее состояние своей заявки.
  Future<MatchRequest> get(String id) => _api.requestById(id);

  /// `POST /v1/requests/{id}/cancel` — отменить свою заявку.
  ///
  /// Бриф задачи описывал сигнатуру как `Future<void>`, но бэкенд отвечает
  /// полным `RequestDto`, и возвращать его дешевле, чем выбрасывать:
  /// контроллер применяет статус ИЗ ОТВЕТА, а не проставляет `cancelled`
  /// вслепую — если гонка (эксперт согласился в ту же секунду) закрыла
  /// заявку иначе, экран увидит настоящий исход.
  Future<MatchRequest> cancel(String id) => _api.cancelRequest(id);

  /// `GET /v1/matching/online-count` — сколько подходящих экспертов сейчас
  /// онлайн (задача 9). [urgentOnly] — только принимающие экстренные
  /// заявки (Р-16).
  Future<int> onlineCount({
    required String topicSlug,
    required SessionFormat format,
    bool? urgentOnly,
  }) async {
    final result = await _api.onlineCount(
      topicSlug: topicSlug,
      format: format,
      urgentOnly: urgentOnly,
    );
    return result.count;
  }
}

final requestsRepositoryProvider = Provider<RequestsRepository>(
  (ref) => RequestsRepository(ref.watch(sqApiProvider)),
);
