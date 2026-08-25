import 'package:freezed_annotation/freezed_annotation.dart';

part 'schedule_exception.freezed.dart';
part 'schedule_exception.g.dart';

/// Исключение в расписании эксперта: выходной день или нестандартное рабочее время.
///
/// [date] — дата в формате 'YYYY-MM-DD'. [isDayOff] — выходной ли день.
/// Если `true`, [startMin] и [endMin] игнорируются. Если `false`, оба
/// [startMin] и [endMin] должны быть установлены (клиентский assert перед отправкой).
@freezed
abstract class ScheduleException with _$ScheduleException {
  const factory ScheduleException({
    required String date,
    required bool isDayOff,
    @JsonKey(includeIfNull: false) int? startMin,
    @JsonKey(includeIfNull: false) int? endMin,
  }) = _ScheduleException;

  factory ScheduleException.fromJson(Map<String, dynamic> json) =>
      _$ScheduleExceptionFromJson(json);
}
