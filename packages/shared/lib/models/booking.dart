import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';

part 'booking.freezed.dart';
part 'booking.g.dart';

/// Свободный слот специалиста (`SlotDto`).
///
/// Бэкенд отдаёт время в UTC; показывать его пользователю нужно по Алматы —
/// единая зона MVP (ТЗ §4.4).
@freezed
abstract class Slot with _$Slot {
  const factory Slot({required DateTime startAt}) = _Slot;

  factory Slot.fromJson(Map<String, dynamic> json) => _$SlotFromJson(json);
}

/// Результат записи или переноса (`BookingResultDto`).
@freezed
abstract class BookingResult with _$BookingResult {
  const factory BookingResult({
    required String consultationId,
    required DateTime startedAt,
    required ConsultationStatus status,
    required ConsultationPaymentStatus paymentStatus,
  }) = _BookingResult;

  factory BookingResult.fromJson(Map<String, dynamic> json) =>
      _$BookingResultFromJson(json);
}
