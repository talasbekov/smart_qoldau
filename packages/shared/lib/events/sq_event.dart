/// Типизированные реалтайм-события бэкенда SmartQoldau (см.
/// `backend/src/ws/events.gateway.ts` и `events.service.ts`).
library;

import '../models/models.dart';

/// Разобранное реалтайм-событие. Плоская иерархия (без freezed — как
/// `AuthState` в `app_client`): значений мало, сравнивать их на равенство
/// нигде не требуется, а генератор добавил бы кодоген ради четырёх полей.
///
/// [SqEvent.fromRaw] — единственная точка разбора сырой пары `(имя
/// события, payload)`. Неизвестное имя события (в том числе экспертские
/// `offer.new`/`offer.revoked`/`earning.credited`/`payout.updated`, которые
/// клиент по контракту никогда не получает) и любой сбой разбора известного
/// события (неожиданно отсутствующее обязательное поле и т.п.) одинаково
/// деградируют в [UnknownEvent] — шина обязана пережить рассинхрон с
/// бэкендом, а не уронить поток (см. брифинг задачи 8: `EventsService
/// .safeEmit` бэкенда — best-effort, «шина не единственный источник
/// истины»).
sealed class SqEvent {
  const SqEvent();

  factory SqEvent.fromRaw(String event, dynamic data) {
    try {
      return _parse(event, data);
    } catch (_) {
      return UnknownEvent(name: event, data: data);
    }
  }

  static SqEvent _parse(String event, dynamic data) {
    final json =
        data is Map ? data.cast<String, dynamic>() : const <String, dynamic>{};
    return switch (event) {
      'request.updated' => RequestUpdated(
          id: json['id'] as String,
          status: _requestStatus(json['status'] as String),
          matchedExpert: json['matchedExpert'] == null
              ? null
              : ExpertPublic.fromJson(
                  (json['matchedExpert'] as Map).cast<String, dynamic>(),
                ),
          consultationId: json['consultationId'] as String?,
          hotlines: (json['hotlines'] as List?)?.cast<String>(),
        ),
      'consultation.updated' => ConsultationUpdated(
          id: json['id'] as String,
          status: _consultationStatus(json['status'] as String?),
          outcome: _consultationOutcome(json['outcome'] as String?),
          paymentStatus:
              _consultationPaymentStatus(json['paymentStatus'] as String?),
          format: _sessionFormat(json['format'] as String?),
          // Перенос плановой записи второй стороной (E6b) меняет время —
          // без него карточка показывала бы старое до перезагрузки.
          startedAt: json['startedAt'] == null
              ? null
              : DateTime.parse(json['startedAt'] as String),
        ),
      'chat.message' => ChatMessageEvent(ChatMessage.fromJson(json)),
      'chat.typing' => ChatTypingEvent(
          consultationId: json['consultationId'] as String,
          senderRole: json['senderRole'] as String,
        ),
      'chat.error' => ChatErrorEvent(json['code'] as String),
      'notification.new' => NotificationNew(
          id: json['id'] as String,
          type: json['type'] as String,
        ),
      _ => UnknownEvent(name: event, data: data),
    };
  }
}

/// `request.updated` — статус заявки на подбор эксперта изменился.
/// [matchedExpert]/[consultationId] приходят только при `status == matched`,
/// [hotlines] — только при `status == callbackRequested` (см. `MatchRequest`
/// про тот же паттерн условного присутствия полей у бэкенда).
final class RequestUpdated extends SqEvent {
  const RequestUpdated({
    required this.id,
    required this.status,
    this.matchedExpert,
    this.consultationId,
    this.hotlines,
  });

  final String id;
  final RequestStatus status;
  final ExpertPublic? matchedExpert;
  final String? consultationId;
  final List<String>? hotlines;

  @override
  String toString() =>
      'RequestUpdated(id: $id, status: $status, consultationId: $consultationId)';
}

/// `consultation.updated` — частичный патч консультации. Бэкенд шлёт это
/// событие из нескольких мест с разным подмножеством полей (см. брифинг
/// задачи 8) — здесь ВСЕ поля, кроме [id], опциональны, и `null` означает
/// «это место не сообщило про это поле», а не «поле сброшено».
final class ConsultationUpdated extends SqEvent {
  const ConsultationUpdated({
    required this.id,
    this.status,
    this.outcome,
    this.paymentStatus,
    this.format,
    this.startedAt,
  });

  final String id;
  final ConsultationStatus? status;
  final ConsultationOutcome? outcome;
  final ConsultationPaymentStatus? paymentStatus;
  final SessionFormat? format;

  /// Новое время начала после переноса; `null` — время не менялось.
  final DateTime? startedAt;

  @override
  String toString() => 'ConsultationUpdated(id: $id, status: $status, '
      'outcome: $outcome, paymentStatus: $paymentStatus, format: $format, '
      'startedAt: $startedAt)';
}

/// `chat.message` — новое сообщение чата консультации.
final class ChatMessageEvent extends SqEvent {
  const ChatMessageEvent(this.message);

  final ChatMessage message;

  /// НЕ включает `message.text` — это содержимое переписки (PII), ему не
  /// место в логах/диагностике (см. Global Constraints задачи 8).
  @override
  String toString() => 'ChatMessageEvent(id: ${message.id}, '
      'consultationId: ${message.consultationId}, '
      'senderRole: ${message.senderRole})';
}

/// `chat.typing` — собеседник печатает.
final class ChatTypingEvent extends SqEvent {
  const ChatTypingEvent({required this.consultationId, required this.senderRole});

  final String consultationId;

  /// `client`/`expert` — как и `ChatMessage.senderRole`, у бэкенда это
  /// обычная строка, не enum.
  final String senderRole;

  @override
  String toString() =>
      'ChatTypingEvent(consultationId: $consultationId, senderRole: $senderRole)';
}

/// `chat.error` — `chat.send`/`chat.typing` не выполнились на бэкенде
/// (см. `EventsGateway.handleChatSend`). `code` — один из [ApiErrorCode].
final class ChatErrorEvent extends SqEvent {
  const ChatErrorEvent(this.code);

  final String code;

  @override
  String toString() => 'ChatErrorEvent(code: $code)';
}

/// `notification.new` — новая запись в центре уведомлений. Бэкенд
/// (`NotificationsService.dispatch`) в реальности шлёт больше полей
/// (`title`, `body`, `data`, `createdAt`), но модель события сознательно
/// берёт только `id`/`type` (по брифу задачи 8) — центр уведомлений реагирует
/// на этот сигнал перезапросом страницы через REST, а не рендерит событие
/// напрямую; лишние поля просто игнорируются разбором, не роняя его.
final class NotificationNew extends SqEvent {
  const NotificationNew({required this.id, required this.type});

  final String id;
  final String type;

  @override
  String toString() => 'NotificationNew(id: $id, type: $type)';
}

/// Незнакомое имя события ИЛИ известное имя с payload'ом, который не
/// удалось разобрать. `data` — исходный сырой payload как есть.
final class UnknownEvent extends SqEvent {
  const UnknownEvent({required this.name, required this.data});

  final String name;
  final dynamic data;

  /// НЕ включает [data] — для незнакомых серверных событий состав payload'а
  /// непредсказуем и может случайно содержать чувствительные поля; для
  /// диагностики достаточно имени события.
  @override
  String toString() => 'UnknownEvent(name: $name)';
}

// --- разбор enum'ов с проводного формата ---
//
// json_serializable генерирует конверсию `@JsonValue` внутри каждого
// generated-файла отдельно (`_$RequestStatusEnumMap` и т.п.) как
// library-приватный символ — переиспользовать его из этого файла нельзя.
// Модели, которые содержат эти enum'ы целиком (`MatchRequest`,
// `ClientConsultation`), тут тоже не подходят: события несут только
// подмножество их полей. Поэтому — небольшие ручные парсеры, дословно по
// `@JsonValue` из `enums.dart`.

RequestStatus _requestStatus(String raw) => switch (raw) {
      'SEARCHING' => RequestStatus.searching,
      'MATCHED' => RequestStatus.matched,
      'CANCELLED' => RequestStatus.cancelled,
      'NO_EXPERTS' => RequestStatus.noExperts,
      'CALLBACK_REQUESTED' => RequestStatus.callbackRequested,
      _ => throw ArgumentError('неизвестный RequestStatus: $raw'),
    };

ConsultationStatus? _consultationStatus(String? raw) => switch (raw) {
      null => null,
      'ACTIVE' => ConsultationStatus.active,
      'COMPLETED' => ConsultationStatus.completed,
      'CANCELLED' => ConsultationStatus.cancelled,
      _ => throw ArgumentError('неизвестный ConsultationStatus: $raw'),
    };

ConsultationOutcome? _consultationOutcome(String? raw) => switch (raw) {
      null => null,
      'COMPLETED' => ConsultationOutcome.completed,
      'CLIENT_NO_SHOW' => ConsultationOutcome.clientNoShow,
      'CLIENT_CANCELLED' => ConsultationOutcome.clientCancelled,
      'TECH_ISSUE' => ConsultationOutcome.techIssue,
      _ => throw ArgumentError('неизвестный ConsultationOutcome: $raw'),
    };

ConsultationPaymentStatus? _consultationPaymentStatus(String? raw) =>
    switch (raw) {
      null => null,
      'UNPAID' => ConsultationPaymentStatus.unpaid,
      'HELD' => ConsultationPaymentStatus.held,
      'CAPTURED' => ConsultationPaymentStatus.captured,
      'VOIDED' => ConsultationPaymentStatus.voided,
      'FAILED' => ConsultationPaymentStatus.failed,
      _ => throw ArgumentError('неизвестный ConsultationPaymentStatus: $raw'),
    };

SessionFormat? _sessionFormat(String? raw) => switch (raw) {
      null => null,
      'chat' => SessionFormat.chat,
      'audio' => SessionFormat.audio,
      'video' => SessionFormat.video,
      _ => throw ArgumentError('неизвестный SessionFormat: $raw'),
    };
