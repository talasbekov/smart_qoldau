/// Профиль эксперта и presence: тонкая обёртка над `SqApiExpertProfile`
/// (E7 задача 10).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

class HomeRepository {
  const HomeRepository(this._api);

  final SqApi _api;

  /// `GET /experts/me` — профиль текущего эксперта.
  Future<ExpertMe> me() => _api.me();

  /// `PATCH /experts/me/work-status` — установить статус работы.
  Future<ExpertMe> setWorkStatus(WorkStatus status) =>
      _api.setWorkStatus(status);

  /// `POST /experts/me/heartbeat` — сигнал о доступности.
  Future<void> heartbeat() => _api.heartbeat();
}

final homeRepositoryProvider = Provider<HomeRepository>(
  (ref) => HomeRepository(ref.watch(sqApiProvider)),
);
