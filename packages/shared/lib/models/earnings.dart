import 'package:freezed_annotation/freezed_annotation.dart';

part 'earnings.freezed.dart';
part 'earnings.g.dart';

/// Одна строка начислений эксперта — только capture-платежи, Р-02
/// (`EarningsItemDto` бэкенда).
@freezed
abstract class EarningsItemDto with _$EarningsItemDto {
  const factory EarningsItemDto({
    required String consultationId,
    required int priceTiyn,
    required int commissionTiyn,
    required int netTiyn,
    required DateTime createdAt,
  }) = _EarningsItemDto;

  factory EarningsItemDto.fromJson(Map<String, dynamic> json) =>
      _$EarningsItemDtoFromJson(json);
}

/// `GET /experts/me/earnings` — список начислений + текущий баланс из
/// ledger (`EarningsDto` бэкенда).
@freezed
abstract class EarningsDto with _$EarningsDto {
  const factory EarningsDto({
    required int balanceTiyn,
    required List<EarningsItemDto> items,
  }) = _EarningsDto;

  factory EarningsDto.fromJson(Map<String, dynamic> json) =>
      _$EarningsDtoFromJson(json);
}
