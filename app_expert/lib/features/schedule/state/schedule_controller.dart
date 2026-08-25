/// Состояние и контроллер экрана недельного расписания (E7 задача 8).
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/schedule_repository.dart';

/// Локальная (клиентская) ошибка валидации расписания — брошена ДО любого
/// сетевого вызова, тем же приёмом, что `ArgumentError` в `SqApiSchedule`
/// (задача 7): экран обязан заметить проблему сам и не тратить запрос.
class ScheduleValidationException implements Exception {
  const ScheduleValidationException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Управляет еженедельным расписанием: 7 дней (пн..вс, `weekday: 0..6`).
///
/// [save] всегда шлёт ПОЛНЫЙ текущий массив из 7 дней — контракт
/// `updateSchedule` (задача 7) это полная замена, а не патч по одному дню,
/// поэтому даже если менялся один день, отправляются все семь.
class ScheduleController extends AsyncNotifier<List<ScheduleDay>> {
  @override
  FutureOr<List<ScheduleDay>> build() => _repo.schedule();

  ScheduleRepository get _repo => ref.read(scheduleRepositoryProvider);

  List<ScheduleDay> _requireDays() {
    final days = state.valueOrNull;
    if (days == null) {
      throw StateError('Schedule not loaded yet');
    }
    return days;
  }

  /// Переключает `enabled` только у дня [weekday] — остальные 6 записей
  /// в состоянии остаются теми же объектами (не пересобираются).
  void toggleDay(int weekday) {
    final days = _requireDays();
    state = AsyncData([
      for (final d in days)
        d.weekday == weekday ? d.copyWith(enabled: !d.enabled) : d,
    ]);
  }

  /// Устанавливает рабочие часы дня [weekday] — минуты от полуночи
  /// (`startMin = t.hour * 60 + t.minute`, конвертация из `TimeOfDay`
  /// делается экраном).
  void setHours(int weekday, {required int startMin, required int endMin}) {
    final days = _requireDays();
    state = AsyncData([
      for (final d in days)
        d.weekday == weekday
            ? d.copyWith(startMin: startMin, endMin: endMin)
            : d,
    ]);
  }

  /// Устанавливает (или убирает, если оба `null`) перерыв дня [weekday].
  void setBreak(int weekday, {int? start, int? end}) {
    final days = _requireDays();
    state = AsyncData([
      for (final d in days)
        d.weekday == weekday ? d.copyWith(breakStart: start, breakEnd: end) : d,
    ]);
  }

  /// Валидирует текущее состояние ЛОКАЛЬНО и, если всё в порядке, шлёт
  /// весь массив в `updateSchedule`. Бросает [ScheduleValidationException]
  /// (без обращения к сети), если у включённого дня время окончания не
  /// позже времени начала, либо часы не заданы вовсе.
  Future<void> save() async {
    final days = _requireDays();
    for (final d in days) {
      if (!d.enabled) continue;
      if (d.startMin == null || d.endMin == null) {
        throw ScheduleValidationException(
          'Укажите время работы для ${_dayLabel(d.weekday)}',
        );
      }
      if (d.endMin! <= d.startMin!) {
        throw ScheduleValidationException(
          'Время окончания должно быть позже начала (${_dayLabel(d.weekday)})',
        );
      }
    }

    final previous = state;
    state = const AsyncLoading<List<ScheduleDay>>().copyWithPrevious(previous);
    state = await AsyncValue.guard(() => _repo.updateSchedule(days));
  }
}

const _dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

String _dayLabel(int weekday) => _dayNames[weekday];

final scheduleControllerProvider =
    AsyncNotifierProvider<ScheduleController, List<ScheduleDay>>(
      ScheduleController.new,
    );
