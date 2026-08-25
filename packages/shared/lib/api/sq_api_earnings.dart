import '../models/models.dart';
import 'sq_api_base.dart';
import 'sq_endpoints.dart';

/// Доход, баланс и выплаты эксперта (E7 задача 14).
mixin SqApiEarnings on SqApiBase {
  /// `GET /experts/me/earnings` — начисления (только capture-платежи,
  /// Р-02) + текущий баланс.
  Future<EarningsDto> earnings({int? take, int? skip}) => guard(() async {
        final response = await dio.get<Map<String, dynamic>>(
          SqEndpoints.expertsMeEarnings,
          queryParameters: {'take': ?take, 'skip': ?skip},
        );
        return EarningsDto.fromJson(response.data!);
      });

  /// `GET /experts/me/balance` — доступно к выводу (Р-06).
  Future<BalanceDto> balance() => guard(() async {
        final response = await dio.get<Map<String, dynamic>>(
          SqEndpoints.expertsMeBalance,
        );
        return BalanceDto.fromJson(response.data!);
      });

  /// `POST /payouts` — заявка на вывод. Лимиты (минимум 10 000 ₸,
  /// автоодобрение ≤300 000 ₸/мес) проверяет бэкенд — клиент только
  /// показывает [PayoutDto.status]/[PayoutDto.rejectReason] из ответа.
  Future<PayoutDto> requestPayout({
    required int amountTiyn,
    required String pan,
    required String expiry,
    required String holderName,
  }) =>
      guard(() async {
        final response = await dio.post<Map<String, dynamic>>(
          SqEndpoints.payouts,
          data: {
            'amountTiyn': amountTiyn,
            'pan': pan,
            'expiry': expiry,
            'holderName': holderName,
          },
        );
        return PayoutDto.fromJson(response.data!);
      });

  /// `GET /payouts` — свои выводы, новые сверху.
  Future<List<PayoutDto>> payouts({int? take, int? skip}) => guard(() async {
        final response = await dio.get<Map<String, dynamic>>(
          SqEndpoints.payouts,
          queryParameters: {'take': ?take, 'skip': ?skip},
        );
        final items = response.data!['items'] as List<dynamic>;
        return items
            .cast<Map<String, dynamic>>()
            .map(PayoutDto.fromJson)
            .toList();
      });
}
