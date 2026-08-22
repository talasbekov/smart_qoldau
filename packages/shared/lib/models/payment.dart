import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';

part 'payment.freezed.dart';
part 'payment.g.dart';

/// Привязанная карта клиента (`PaymentMethodDto`). PAN на клиента никогда не
/// возвращается — только маска.
@freezed
abstract class PaymentMethod with _$PaymentMethod {
  const factory PaymentMethod({
    required String id,
    required String maskedPan,
    required String brand,
    required String holderName,
  }) = _PaymentMethod;

  factory PaymentMethod.fromJson(Map<String, dynamic> json) =>
      _$PaymentMethodFromJson(json);
}

/// Статус платежа консультации (`PaymentStatusDto`).
@freezed
abstract class PaymentStatusInfo with _$PaymentStatusInfo {
  const factory PaymentStatusInfo({
    required PaymentStatus status,
    required int amountTiyn,
    required String maskedPan,
  }) = _PaymentStatusInfo;

  factory PaymentStatusInfo.fromJson(Map<String, dynamic> json) =>
      _$PaymentStatusInfoFromJson(json);
}

/// Результат попытки оплаты (`PayResultDto`).
@freezed
abstract class PayResult with _$PayResult {
  const factory PayResult({required PaymentStatus status}) = _PayResult;

  factory PayResult.fromJson(Map<String, dynamic> json) =>
      _$PayResultFromJson(json);
}
