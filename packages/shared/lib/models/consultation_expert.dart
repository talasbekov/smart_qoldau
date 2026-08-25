import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';

part 'consultation_expert.freezed.dart';
part 'consultation_expert.g.dart';

/// Консультация со стороны эксперта (`ConsultationExpertDto` бэкенда,
/// `GET /consultations?as=expert`). PII-инвариант: только [clientCode],
/// никакого userId/телефона клиента — зеркалит `OfferDto`/`RequestDto`.
///
/// Без поля `expert` — это карточка самого себя, в отличие от
/// [ClientConsultation], где эксперт — чужой профиль, который клиенту
/// нужно показать.
@freezed
abstract class ConsultationExpertDto with _$ConsultationExpertDto {
  const factory ConsultationExpertDto({
    required String id,
    required ConsultationStatus status,
    ConsultationOutcome? outcome,
    required SessionFormat format,
    required bool isEmergency,
    required DateTime startedAt,
    DateTime? endedAt,
    required int clientCode,
    required String topicSlug,
    required int priceTiyn,
    required int plannedDurationMin,
    required ConsultationPaymentStatus paymentStatus,
  }) = _ConsultationExpertDto;

  factory ConsultationExpertDto.fromJson(Map<String, dynamic> json) =>
      _$ConsultationExpertDtoFromJson(json);
}
