import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';

part 'offer.freezed.dart';
part 'offer.g.dart';

/// Активный PENDING-оффер эксперта (`OfferDto` бэкенда). PII-инвариант:
/// только [clientCode], никаких данных клиента.
@freezed
abstract class OfferDto with _$OfferDto {
  const factory OfferDto({
    required String offerId,
    required String topicSlug,
    required SessionFormat format,
    required bool isEmergency,
    required int clientCode,
    required DateTime deadlineAt,
  }) = _OfferDto;

  factory OfferDto.fromJson(Map<String, dynamic> json) =>
      _$OfferDtoFromJson(json);
}

/// Результат принятия оффера (`AcceptOfferDto` бэкенда) — заявка сматчена.
@freezed
abstract class AcceptOfferDto with _$AcceptOfferDto {
  const factory AcceptOfferDto({
    required String requestId,
    required RequestStatus status,
    required String consultationId,
  }) = _AcceptOfferDto;

  factory AcceptOfferDto.fromJson(Map<String, dynamic> json) =>
      _$AcceptOfferDtoFromJson(json);
}
