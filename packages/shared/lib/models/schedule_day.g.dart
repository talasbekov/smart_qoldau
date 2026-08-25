// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'schedule_day.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ScheduleDay _$ScheduleDayFromJson(Map<String, dynamic> json) => _ScheduleDay(
  weekday: (json['weekday'] as num).toInt(),
  enabled: json['enabled'] as bool,
  startMin: (json['startMin'] as num?)?.toInt(),
  endMin: (json['endMin'] as num?)?.toInt(),
  breakStart: (json['breakStart'] as num?)?.toInt(),
  breakEnd: (json['breakEnd'] as num?)?.toInt(),
);

Map<String, dynamic> _$ScheduleDayToJson(_ScheduleDay instance) =>
    <String, dynamic>{
      'weekday': instance.weekday,
      'enabled': instance.enabled,
      'startMin': ?instance.startMin,
      'endMin': ?instance.endMin,
      'breakStart': ?instance.breakStart,
      'breakEnd': ?instance.breakEnd,
    };
