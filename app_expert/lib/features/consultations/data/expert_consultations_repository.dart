/// Консультации текущего эксперта: тонкая обёртка над
/// `SqApiConsultations.expertConsultations` (E7 задача 12).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

class ExpertConsultationsRepository {
  const ExpertConsultationsRepository(this._api);

  final SqApi _api;

  /// `GET /consultations?as=expert&status=...` — список консультаций
  /// эксперта по одному статусу.
  Future<List<ConsultationExpertDto>> list({required ConsultationStatus status}) =>
      _api.expertConsultations(status: status);

  /// `GET /consultations/{id}` — консультация, где вызывающий — эксперт-
  /// участник (E7 задача 13).
  Future<ConsultationExpertDto> byId(String id) => _api.expertConsultationById(id);

  /// `POST /consultations/{id}/complete` — завершить с исходом.
  Future<ConsultationExpertDto> complete(String id, ConsultationOutcome outcome) =>
      _api.completeConsultation(id, outcome);
}

final expertConsultationsRepositoryProvider =
    Provider<ExpertConsultationsRepository>(
  (ref) => ExpertConsultationsRepository(ref.watch(sqApiProvider)),
);
