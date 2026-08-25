// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'schedule_exception.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ScheduleException _$ScheduleExceptionFromJson(Map<String, dynamic> json) =>
    _ScheduleException(
      date: json['date'] as String,
      isDayOff: json['isDayOff'] as bool,
      startMin: (json['startMin'] as num?)?.toInt(),
      endMin: (json['endMin'] as num?)?.toInt(),
    );

Map<String, dynamic> _$ScheduleExceptionToJson(_ScheduleException instance) =>
    <String, dynamic>{
      'date': instance.date,
      'isDayOff': instance.isDayOff,
      'startMin': ?instance.startMin,
      'endMin': ?instance.endMin,
    };
