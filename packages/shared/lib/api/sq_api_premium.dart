import '../models/models.dart';
import 'sq_api_base.dart';
import 'sq_endpoints.dart';

/// Подписка Premium (E12).
mixin SqApiPremium on SqApiBase {
  /// `GET /premium` — статус подписки текущего пользователя.
  Future<PremiumStatus> premiumStatus() => guard(() async {
        final response = await dio.get<Map<String, dynamic>>(
          SqEndpoints.premium,
        );
        return PremiumStatus.fromJson(response.data!);
      });

  /// `POST /premium/subscribe` — оформить подписку привязанной картой.
  /// Деньги списываются сразу: доступ выдаётся по факту оплаты.
  Future<PremiumStatus> subscribePremium({
    required PremiumPlan plan,
    required String paymentMethodId,
  }) =>
      guard(() async {
        final response = await dio.post<Map<String, dynamic>>(
          SqEndpoints.premiumSubscribe,
          data: {
            'plan': plan == PremiumPlan.year ? 'YEAR' : 'MONTH',
            'paymentMethodId': paymentMethodId,
          },
        );
        return PremiumStatus.fromJson(response.data!);
      });

  /// `POST /premium/cancel` — отменить автопродление. Доступ сохраняется до
  /// конца оплаченного периода (Р-09).
  Future<PremiumStatus> cancelPremium() => guard(() async {
        final response = await dio.post<Map<String, dynamic>>(
          SqEndpoints.premiumCancel,
        );
        return PremiumStatus.fromJson(response.data!);
      });
}
