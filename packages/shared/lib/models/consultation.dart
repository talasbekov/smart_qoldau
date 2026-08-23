import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';
import 'expert.dart';

part 'consultation.freezed.dart';
part 'consultation.g.dart';

/// Консультация со стороны клиента (`ConsultationClientDto` бэкенда).
/// Бэкенд отдаёт и `ConsultationExpertDto` (форма для эксперта) через тот же
/// эндпоинт при `as=expert`, но клиентское приложение всегда запрашивает
/// `as=client` — вторая форма вне области этой задачи.
@freezed
abstract class ClientConsultation with _$ClientConsultation {
  const factory ClientConsultation({
    required String id,
    required ConsultationStatus status,
    ConsultationOutcome? outcome,
    required SessionFormat format,
    required bool isEmergency,
    required DateTime startedAt,
    DateTime? endedAt,
    required int priceTiyn,
    required int plannedDurationMin,
    required ConsultationPaymentStatus paymentStatus,
    required ExpertPublic expert,
    /// Идентификатор оставленного отзыва; `null` — отзыва нет. Приходит с
    /// бэкенда (E2a), поэтому переустановка приложения его не теряет.
    String? reviewId,
  }) = _ClientConsultation;

  factory ClientConsultation.fromJson(Map<String, dynamic> json) =>
      _$ClientConsultationFromJson(json);
}
