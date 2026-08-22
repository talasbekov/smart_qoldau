import '../models/models.dart';
import 'sq_api_base.dart';
import 'sq_endpoints.dart';

/// Способы оплаты клиента.
mixin SqApiPayments on SqApiBase {
  /// `GET /payment-methods` — свои живые карты.
  Future<List<PaymentMethod>> paymentMethods() => guard(() async {
        final response = await dio.get<List<dynamic>>(
          SqEndpoints.paymentMethods,
        );
        return response.data!
            .map((e) => PaymentMethod.fromJson(e as Map<String, dynamic>))
            .toList();
      });

  /// `POST /payment-methods` — привязать карту.
  Future<PaymentMethod> addPaymentMethod({
    required String pan,
    required String expiry,
    required String holderName,
  }) =>
      guard(() async {
        final response = await dio.post<Map<String, dynamic>>(
          SqEndpoints.paymentMethods,
          data: {'pan': pan, 'expiry': expiry, 'holderName': holderName},
        );
        return PaymentMethod.fromJson(response.data!);
      });

  /// `DELETE /payment-methods/{id}` — открепить карту (soft-delete).
  Future<void> deletePaymentMethod(String id) => guard(() async {
        await dio.delete<void>(SqEndpoints.paymentMethodById(id));
      });
}
