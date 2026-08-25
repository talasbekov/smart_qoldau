/// Доступ к справочнику тем и активной консультации клиента для главного
/// экрана — тонкий фасад над `SqApi`, чтобы `HomeController` занимался
/// только состоянием (по образцу `AuthRepository`/`AuthController`).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';


class TopicsRepository {
  const TopicsRepository(this._api);

  final SqApi _api;

  /// `GET /v1/topics?locale=` — справочник тем на языке [locale] (`ru`/`kz`,
  /// см. `localeToApi`).
  Future<List<Topic>> topics({required String locale}) =>
      _api.topics(locale: locale);

  /// Первая активная консультация клиента (`GET /v1/consultations?as=
  /// client&status=ACTIVE`) — `null`, если активной консультации нет.
  Future<ClientConsultation?> activeConsultation() async {
    final list = await _api.consultations(status: ConsultationStatus.active);
    return list.isEmpty ? null : list.first;
  }
}

final topicsRepositoryProvider = Provider<TopicsRepository>(
  (ref) => TopicsRepository(ref.watch(sqApiProvider)),
);
