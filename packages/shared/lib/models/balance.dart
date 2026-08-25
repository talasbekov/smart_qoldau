import 'package:freezed_annotation/freezed_annotation.dart';

part 'balance.freezed.dart';
part 'balance.g.dart';

/// `GET /experts/me/balance` — баланс эксперта и доступное к выводу
/// (`BalanceDto` бэкенда, Р-06).
@freezed
abstract class BalanceDto with _$BalanceDto {
  const factory BalanceDto({
    required int balanceTiyn,
    required int availableTiyn,
  }) = _BalanceDto;

  factory BalanceDto.fromJson(Map<String, dynamic> json) =>
      _$BalanceDtoFromJson(json);
}
