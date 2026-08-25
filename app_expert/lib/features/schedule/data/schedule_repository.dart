/// Расписание и исключения эксперта: тонкая обёртка над `SqApiSchedule`
/// (E7 задача 8, API — задача 7).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

class ScheduleRepository {
  const ScheduleRepository(this._api);

  final SqApi _api;

  /// `GET /experts/me/schedule` — еженедельное расписание, ровно 7 дней.
  Future<List<ScheduleDay>> schedule() => _api.schedule();

  /// `PUT /experts/me/schedule` — полная замена расписания (все 7 дней).
  Future<List<ScheduleDay>> updateSchedule(List<ScheduleDay> days) =>
      _api.updateSchedule(days);

  /// `GET /experts/me/schedule/exceptions` за период [from]–[to].
  Future<List<ScheduleException>> exceptions({
    required String from,
    required String to,
  }) => _api.exceptions(from: from, to: to);

  /// `PUT /experts/me/schedule/exceptions/{date}` — создать/обновить.
  Future<ScheduleException> upsertException(
    String date, {
    required bool isDayOff,
    int? startMin,
    int? endMin,
  }) => _api.upsertException(
    date,
    isDayOff: isDayOff,
    startMin: startMin,
    endMin: endMin,
  );

  /// `DELETE /experts/me/schedule/exceptions/{date}` — идемпотентно.
  Future<void> deleteException(String date) => _api.deleteException(date);
}

final scheduleRepositoryProvider = Provider<ScheduleRepository>(
  (ref) => ScheduleRepository(ref.watch(sqApiProvider)),
);
