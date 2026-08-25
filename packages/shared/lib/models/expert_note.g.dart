// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'expert_note.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ExpertNoteDto _$ExpertNoteDtoFromJson(Map<String, dynamic> json) =>
    _ExpertNoteDto(
      text: json['text'] as String?,
      updatedAt: json['updatedAt'] == null
          ? null
          : DateTime.parse(json['updatedAt'] as String),
    );

Map<String, dynamic> _$ExpertNoteDtoToJson(_ExpertNoteDto instance) =>
    <String, dynamic>{
      'text': instance.text,
      'updatedAt': instance.updatedAt?.toIso8601String(),
    };
