/// Карты клиента, оплата консультации холдом и данные для экрана
/// «специалист найден» — тонкий фасад над `SqApi`.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

class PaymentsRepository {
  const PaymentsRepository(this._api);

  final SqApi _api;

  /// `GET /v1/payment-methods` — живые карты клиента.
  ///
  /// Бриф просил показывать «последнюю использованную первой», но в
  /// `PaymentMethodDto` бэкенда такого поля нет (`id`/`maskedPan`/`brand`/
  /// `holderName`), и вычислить его клиенту не из чего. Порядок остаётся
  /// серверным — расхождение названо вслух, а не подменено догадкой.
  Future<List<PaymentMethod>> cards() => _api.paymentMethods();

  /// `POST /v1/payment-methods` — привязать карту. [pan] — только цифры,
  /// без пробелов маски.
  Future<PaymentMethod> addCard({
    required String pan,
    required String expiry,
    required String holderName,
  }) => _api.addPaymentMethod(pan: pan, expiry: expiry, holderName: holderName);

  /// `DELETE /v1/payment-methods/{id}` — открепить карту.
  Future<void> deleteCard(String id) => _api.deletePaymentMethod(id);

  /// `POST /v1/consultations/{id}/pay` — эскроу-холд (Р-01).
  Future<PayResult> pay({
    required String consultationId,
    required String paymentMethodId,
  }) => _api.payConsultation(consultationId, paymentMethodId: paymentMethodId);

  /// `GET /v1/consultations/{id}/payment` — статус платежа.
  Future<PaymentStatusInfo> paymentStatus(String consultationId) =>
      _api.consultationPayment(consultationId);

  /// `GET /v1/consultations/{id}` — консультация (цена и длительность для
  /// шторки оплаты).
  Future<ClientConsultation> consultation(String id) =>
      _api.consultationById(id);

  /// `POST /v1/consultations/{id}/cancel` — отказ от консультации.
  Future<ClientConsultation> cancelConsultation(String id) =>
      _api.cancelConsultation(id);
}

final paymentsRepositoryProvider = Provider<PaymentsRepository>(
  (ref) => PaymentsRepository(ref.watch(sqApiProvider)),
);
