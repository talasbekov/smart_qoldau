import '../models/models.dart';
import 'sq_api_base.dart';
import 'sq_endpoints.dart';

/// Расписание эксперта и исключения (E7 задача 7): получение,
/// обновление, и управление дневными и недельными расписаниями.
mixin SqApiSchedule on SqApiBase {
  /// `GET /experts/me/schedule` — получить еженедельное расписание.
  /// Ответ содержит объект `{days: [...]}` с ровно 7 днями (пн..вс).
  Future<List<ScheduleDay>> schedule() => guard(() async {
    final response = await dio.get<Map<String, dynamic>>(
      SqEndpoints.expertsMeSchedule,
    );
    final days = response.data!['days'] as List<dynamic>;
    return days.cast<Map<String, dynamic>>().map(ScheduleDay.fromJson).toList();
  });

  /// `PUT /experts/me/schedule` — обновить еженедельное расписание.
  /// [days] должен содержать ровно 7 элементов — один для каждого дня
  /// недели (пн..вс). Бросает [ArgumentError] клиентской стороной ПЕРЕД
  /// отправкой, если длина != 7.
  Future<List<ScheduleDay>> updateSchedule(List<ScheduleDay> days) {
    if (days.length != 7) {
      throw ArgumentError(
        'Schedule must contain exactly 7 days, got ${days.length}',
      );
    }
    return guard(() async {
      final response = await dio.put<Map<String, dynamic>>(
        SqEndpoints.expertsMeSchedule,
        data: {'days': days.map((d) => d.toJson()).toList()},
      );
      final responseData = response.data!['days'] as List<dynamic>;
      return responseData
          .cast<Map<String, dynamic>>()
          .map(ScheduleDay.fromJson)
          .toList();
    });
  }

  /// `PATCH /experts/me/availability` — установить приём срочных запросов.
  Future<ExpertMe> setAcceptsUrgent(bool value) => guard(() async {
    final response = await dio.patch<Map<String, dynamic>>(
      SqEndpoints.expertsMeAvailability,
      data: {'acceptsUrgent': value},
    );
    return ExpertMe.fromJson(response.data!);
  });

  /// `GET /experts/me/schedule/exceptions` — получить исключения в расписании
  /// за период [from]–[to] (включительно, формат 'YYYY-MM-DD').
  Future<List<ScheduleException>> exceptions({
    required String from,
    required String to,
  }) => guard(() async {
    final response = await dio.get<List<dynamic>>(
      SqEndpoints.expertsMeScheduleExceptions,
      queryParameters: {'from': from, 'to': to},
    );
    return response.data!
        .cast<Map<String, dynamic>>()
        .map(ScheduleException.fromJson)
        .toList();
  });

  /// `PUT /experts/me/schedule/exceptions/{date}` — создать или обновить
  /// исключение на [date] (формат 'YYYY-MM-DD').
  ///
  /// Если [isDayOff] = `true`, исключение — полный выходной день.
  /// Если [isDayOff] = `false`, это день с нестандартным временем работы —
  /// оба [startMin] и [endMin] обязательны. Бросает [ArgumentError] клиентской
  /// стороной ПЕРЕД отправкой, если условие нарушено (зеркалит серверную
  /// проверку контракта).
  Future<ScheduleException> upsertException(
    String date, {
    required bool isDayOff,
    int? startMin,
    int? endMin,
  }) {
    if (!isDayOff && (startMin == null || endMin == null)) {
      throw ArgumentError(
        'When isDayOff=false, both startMin and endMin must be provided',
      );
    }
    return guard(() async {
      final data = <String, dynamic>{'isDayOff': isDayOff};
      if (startMin != null) data['startMin'] = startMin;
      if (endMin != null) data['endMin'] = endMin;

      final response = await dio.put<Map<String, dynamic>>(
        SqEndpoints.expertsMeScheduleExceptionByDate(date),
        data: data,
      );
      return ScheduleException.fromJson(response.data!);
    });
  }

  /// `DELETE /experts/me/schedule/exceptions/{date}` — удалить исключение на [date].
  /// Идемпотентно — повторный вызов для той же даты не бросает ошибку (204).
  Future<void> deleteException(String date) => guard(() async {
    await dio.delete<void>(SqEndpoints.expertsMeScheduleExceptionByDate(date));
  });
}
