/// Доход, баланс и выводы эксперта: тонкая обёртка над `SqApiEarnings`
/// (E7 задача 14).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

class EarningsRepository {
  const EarningsRepository(this._api);

  final SqApi _api;

  /// `GET /experts/me/earnings` — начисления + баланс.
  Future<EarningsDto> earnings({int? take, int? skip}) =>
      _api.earnings(take: take, skip: skip);

  /// `GET /experts/me/balance` — доступно к выводу.
  Future<BalanceDto> balance() => _api.balance();

  /// `POST /payouts` — заявка на вывод.
  Future<PayoutDto> requestPayout({
    required int amountTiyn,
    required String pan,
    required String expiry,
    required String holderName,
  }) =>
      _api.requestPayout(
        amountTiyn: amountTiyn,
        pan: pan,
        expiry: expiry,
        holderName: holderName,
      );

  /// `GET /payouts` — свои выводы.
  Future<List<PayoutDto>> payouts({int? take, int? skip}) =>
      _api.payouts(take: take, skip: skip);
}

final earningsRepositoryProvider = Provider<EarningsRepository>(
  (ref) => EarningsRepository(ref.watch(sqApiProvider)),
);
