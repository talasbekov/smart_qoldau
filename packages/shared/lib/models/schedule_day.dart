import 'package:freezed_annotation/freezed_annotation.dart';

part 'schedule_day.freezed.dart';
part 'schedule_day.g.dart';

/// День расписания эксперта: фиксированное время работы и перерывы.
///
/// [weekday] — дата недели (0 = пн, 6 = вс). [enabled] — работает ли в этот
/// день. Если `false`, поля [startMin], [endMin], [breakStart], [breakEnd]
/// могут быть `null`. Времена в минутах от начала суток (0..1440).
@freezed
abstract class ScheduleDay with _$ScheduleDay {
  const factory ScheduleDay({
    required int weekday,
    required bool enabled,
    @JsonKey(includeIfNull: false) int? startMin,
    @JsonKey(includeIfNull: false) int? endMin,
    @JsonKey(includeIfNull: false) int? breakStart,
    @JsonKey(includeIfNull: false) int? breakEnd,
  }) = _ScheduleDay;

  factory ScheduleDay.fromJson(Map<String, dynamic> json) =>
      _$ScheduleDayFromJson(json);
}
