/// События воронки из ТЗ §10.
///
/// Список закрытый и повторяет ТЗ дословно: аналитика — это контракт с
/// продуктом, а не место для самодеятельности. Свойства — только примитивы
/// и только неперсональные: ни телефона, ни текста сообщений и отзывов, ни
/// маски карты, ни имени специалиста.
library;

sealed class AnalyticsEvent {
  const AnalyticsEvent();

  /// Имя события в snake_case — как в ТЗ §10.
  String get name;

  /// Свойства события. Значения — строки, числа и булевы: вложенные
  /// объекты легко протаскивают в аналитику целые DTO с ПД.
  Map<String, Object?> get properties;
}

class TopicSelected extends AnalyticsEvent {
  const TopicSelected({required this.topicSlug});

  final String topicSlug;

  @override
  String get name => 'topic_selected';

  @override
  Map<String, Object?> get properties => {'topic_slug': topicSlug};
}

class FormatSelected extends AnalyticsEvent {
  const FormatSelected({required this.format});

  final String format;

  @override
  String get name => 'format_selected';

  @override
  Map<String, Object?> get properties => {'format': format};
}

class RequestCreated extends AnalyticsEvent {
  const RequestCreated({required this.requestId, required this.isEmergency});

  final String requestId;
  final bool isEmergency;

  @override
  String get name => 'request_created';

  @override
  Map<String, Object?> get properties => {
    'request_id': requestId,
    'is_emergency': isEmergency,
  };
}

class ExpertMatched extends AnalyticsEvent {
  const ExpertMatched({required this.requestId, required this.secondsToMatch});

  final String requestId;

  /// Время от создания заявки до события матча — тот самый показатель
  /// обещания «1–2 минуты» из критерия приёмки ТЗ §11.1.
  final int secondsToMatch;

  @override
  String get name => 'expert_matched';

  @override
  Map<String, Object?> get properties => {
    'request_id': requestId,
    'seconds_to_match': secondsToMatch,
  };
}

class PaymentSucceeded extends AnalyticsEvent {
  const PaymentSucceeded({
    required this.consultationId,
    required this.priceTiyn,
  });

  final String consultationId;
  final int priceTiyn;

  @override
  String get name => 'payment_succeeded';

  @override
  Map<String, Object?> get properties => {
    'consultation_id': consultationId,
    'price_tiyn': priceTiyn,
  };
}

class PaymentDeclined extends AnalyticsEvent {
  const PaymentDeclined({required this.consultationId, required this.code});

  final String consultationId;

  /// Код ошибки, а не текст провайдера: текст пишет платёжный провайдер и
  /// в него может попасть что угодно.
  final String code;

  @override
  String get name => 'payment_declined';

  @override
  Map<String, Object?> get properties => {
    'consultation_id': consultationId,
    'code': code,
  };
}

class SessionStarted extends AnalyticsEvent {
  const SessionStarted({required this.consultationId, required this.format});

  final String consultationId;
  final String format;

  @override
  String get name => 'session_started';

  @override
  Map<String, Object?> get properties => {
    'consultation_id': consultationId,
    'format': format,
  };
}

class SessionEnded extends AnalyticsEvent {
  const SessionEnded({
    required this.consultationId,
    required this.outcome,
    required this.durationSec,
  });

  final String consultationId;
  final String outcome;
  final int durationSec;

  @override
  String get name => 'session_ended';

  @override
  Map<String, Object?> get properties => {
    'consultation_id': consultationId,
    'outcome': outcome,
    'duration_sec': durationSec,
  };
}

class ReviewSubmitted extends AnalyticsEvent {
  const ReviewSubmitted({required this.consultationId, required this.rating});

  final String consultationId;

  /// Только оценка. Текстов отзывов в аналитике не бывает.
  final int rating;

  @override
  String get name => 'review_submitted';

  @override
  Map<String, Object?> get properties => {
    'consultation_id': consultationId,
    'rating': rating,
  };
}

class GuestConverted extends AnalyticsEvent {
  const GuestConverted();

  @override
  String get name => 'guest_converted';

  @override
  Map<String, Object?> get properties => const {};
}

class EmergencyEscalated extends AnalyticsEvent {
  const EmergencyEscalated({required this.requestId, required this.stage});

  final String requestId;

  /// Шаг эскалации Р-16: `screening`, `danger`, `hotlines`.
  final String stage;

  @override
  String get name => 'emergency_escalated';

  @override
  Map<String, Object?> get properties => {
    'request_id': requestId,
    'stage': stage,
  };
}
