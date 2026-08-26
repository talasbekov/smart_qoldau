/// Подписка Premium (E12) — тонкий фасад над `SqApi`.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

class PremiumRepository {
  const PremiumRepository(this._api);

  final SqApi _api;

  /// `GET /v1/premium` — статус подписки.
  Future<PremiumStatus> status() => _api.premiumStatus();

  /// `POST /v1/premium/subscribe` — оформить подписку картой.
  Future<PremiumStatus> subscribe({
    required PremiumPlan plan,
    required String paymentMethodId,
  }) => _api.subscribePremium(plan: plan, paymentMethodId: paymentMethodId);

  /// `POST /v1/premium/cancel` — отменить автопродление.
  Future<PremiumStatus> cancel() => _api.cancelPremium();

  /// Карты клиента: подписка списывается с привязанной карты, отдельного
  /// платёжного потока у Premium нет.
  Future<List<PaymentMethod>> cards() => _api.paymentMethods();
}

final premiumRepositoryProvider = Provider<PremiumRepository>(
  (ref) => PremiumRepository(ref.watch(sqApiProvider)),
);
