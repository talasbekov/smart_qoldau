/// Консультации клиента — общий фасад над `SqApi` для экранов, которым
/// нужна консультация как таковая (оценка — задача 15, список и детали —
/// задача 17).
///
/// Существующие `PaymentsRepository.consultation` и
/// `ChatRepository.consultation` умеют то же самое: они появились раньше и
/// принадлежат своим фичам. Здесь новый вход, а не переезд, — трогать
/// оплаченный и покрытый тестами путь оплаты/чата ради дедупликации
/// одного вызова было бы риском без выгоды.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

class ConsultationsRepository {
  const ConsultationsRepository(this._api);

  final SqApi _api;

  /// `GET /v1/consultations/{id}`.
  Future<ClientConsultation> byId(String id) => _api.consultationById(id);

  /// `POST /v1/consultations/{id}/cancel` — отмена консультации клиентом
  /// (БП-03).
  Future<ClientConsultation> cancel(String id) => _api.cancelConsultation(id);

  /// `GET /v1/consultations/{id}/payment` — статус платежа. `null`, если
  /// платежа нет (`PAYMENT_NOT_FOUND`, 404) — обычная ветка для
  /// неоплаченной консультации, а не ошибка экрана.
  Future<PaymentStatusInfo?> payment(String id) async {
    try {
      return await _api.consultationPayment(id);
    } on ApiException catch (error) {
      if (error.code == ApiErrorCode.paymentNotFound) return null;
      rethrow;
    }
  }

  /// `GET /v1/consultations?as=client` — список консультаций клиента.
  Future<List<ClientConsultation>> list({
    ConsultationStatus? status,
    int? take,
    int? skip,
  }) => _api.consultations(status: status, take: take, skip: skip);
}

final consultationsRepositoryProvider = Provider<ConsultationsRepository>(
  (ref) => ConsultationsRepository(ref.watch(sqApiProvider)),
);

/// Одна консультация по идентификатору — то, что нужно экрану оценки.
final consultationProvider = FutureProvider.autoDispose
    .family<ClientConsultation, String>(
      (ref, id) => ref.read(consultationsRepositoryProvider).byId(id),
    );
