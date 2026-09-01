// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'content_item.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_BreathingPhase _$BreathingPhaseFromJson(Map<String, dynamic> json) =>
    _BreathingPhase(
      name: json['name'] as String,
      seconds: (json['seconds'] as num).toInt(),
    );

Map<String, dynamic> _$BreathingPhaseToJson(_BreathingPhase instance) =>
    <String, dynamic>{'name': instance.name, 'seconds': instance.seconds};

_ContentItem _$ContentItemFromJson(Map<String, dynamic> json) => _ContentItem(
  id: json['id'] as String,
  kind: $enumDecode(_$ContentKindEnumMap, json['kind']),
  access: $enumDecode(_$ContentAccessEnumMap, json['access']),
  slug: json['slug'] as String,
  category: json['category'] as String,
  title: json['title'] as String,
  summary: json['summary'] as String,
  locked: json['locked'] as bool? ?? false,
  positionPermille: (json['positionPermille'] as num?)?.toInt() ?? 0,
  durationSec: (json['durationSec'] as num?)?.toInt(),
  coverUrl: json['coverUrl'] as String?,
  usefulYes: (json['usefulYes'] as num?)?.toInt(),
  usefulNo: (json['usefulNo'] as num?)?.toInt(),
);

Map<String, dynamic> _$ContentItemToJson(_ContentItem instance) =>
    <String, dynamic>{
      'id': instance.id,
      'kind': _$ContentKindEnumMap[instance.kind]!,
      'access': _$ContentAccessEnumMap[instance.access]!,
      'slug': instance.slug,
      'category': instance.category,
      'title': instance.title,
      'summary': instance.summary,
      'locked': instance.locked,
      'positionPermille': instance.positionPermille,
      'durationSec': instance.durationSec,
      'coverUrl': instance.coverUrl,
      'usefulYes': instance.usefulYes,
      'usefulNo': instance.usefulNo,
    };

const _$ContentKindEnumMap = {
  ContentKind.meditation: 'MEDITATION',
  ContentKind.music: 'MUSIC',
  ContentKind.article: 'ARTICLE',
  ContentKind.breathing: 'BREATHING',
};

const _$ContentAccessEnumMap = {
  ContentAccess.free: 'FREE',
  ContentAccess.premium: 'PREMIUM',
};

_ContentMedia _$ContentMediaFromJson(Map<String, dynamic> json) =>
    _ContentMedia(
      url: json['url'] as String,
      expiresAt: DateTime.parse(json['expiresAt'] as String),
    );

Map<String, dynamic> _$ContentMediaToJson(_ContentMedia instance) =>
    <String, dynamic>{
      'url': instance.url,
      'expiresAt': instance.expiresAt.toIso8601String(),
    };

_ContentProgress _$ContentProgressFromJson(Map<String, dynamic> json) =>
    _ContentProgress(
      positionPermille: (json['positionPermille'] as num).toInt(),
      completed: json['completed'] as bool,
    );

Map<String, dynamic> _$ContentProgressToJson(_ContentProgress instance) =>
    <String, dynamic>{
      'positionPermille': instance.positionPermille,
      'completed': instance.completed,
    };

_ContentVotes _$ContentVotesFromJson(Map<String, dynamic> json) =>
    _ContentVotes(
      usefulYes: (json['usefulYes'] as num).toInt(),
      usefulNo: (json['usefulNo'] as num).toInt(),
    );

Map<String, dynamic> _$ContentVotesToJson(_ContentVotes instance) =>
    <String, dynamic>{
      'usefulYes': instance.usefulYes,
      'usefulNo': instance.usefulNo,
    };

_ContentStreak _$ContentStreakFromJson(Map<String, dynamic> json) =>
    _ContentStreak(
      currentDays: (json['currentDays'] as num).toInt(),
      longestDays: (json['longestDays'] as num).toInt(),
      completedCount: (json['completedCount'] as num).toInt(),
    );

Map<String, dynamic> _$ContentStreakToJson(_ContentStreak instance) =>
    <String, dynamic>{
      'currentDays': instance.currentDays,
      'longestDays': instance.longestDays,
      'completedCount': instance.completedCount,
    };
