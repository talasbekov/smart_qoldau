// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'expert.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ExpertPublic _$ExpertPublicFromJson(Map<String, dynamic> json) =>
    _ExpertPublic(
      id: json['id'] as String,
      displayName: json['displayName'] as String,
      city: json['city'] as String,
      experience: $enumDecode(_$ExperienceLevelEnumMap, json['experience']),
      priceTiyn: (json['priceTiyn'] as num).toInt(),
      languages: (json['languages'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
      formats: (json['formats'] as List<dynamic>)
          .map((e) => $enumDecode(_$SessionFormatEnumMap, e))
          .toList(),
      topicSlugs: (json['topicSlugs'] as List<dynamic>)
          .map((e) => e as String)
          .toList(),
      workStatus: $enumDecode(_$WorkStatusEnumMap, json['workStatus']),
      ratingAvg: (json['ratingAvg'] as num).toDouble(),
      ratingCount: (json['ratingCount'] as num).toInt(),
      photoUrl: json['photoUrl'] as String?,
      about: json['about'] as String?,
    );

Map<String, dynamic> _$ExpertPublicToJson(
  _ExpertPublic instance,
) => <String, dynamic>{
  'id': instance.id,
  'displayName': instance.displayName,
  'city': instance.city,
  'experience': _$ExperienceLevelEnumMap[instance.experience]!,
  'priceTiyn': instance.priceTiyn,
  'languages': instance.languages,
  'formats': instance.formats.map((e) => _$SessionFormatEnumMap[e]!).toList(),
  'topicSlugs': instance.topicSlugs,
  'workStatus': _$WorkStatusEnumMap[instance.workStatus]!,
  'ratingAvg': instance.ratingAvg,
  'ratingCount': instance.ratingCount,
  'photoUrl': instance.photoUrl,
  'about': instance.about,
};

const _$ExperienceLevelEnumMap = {
  ExperienceLevel.lessThanYear: 'LESS_THAN_YEAR',
  ExperienceLevel.oneToThree: 'ONE_TO_THREE',
  ExperienceLevel.threeToFive: 'THREE_TO_FIVE',
  ExperienceLevel.fiveToTen: 'FIVE_TO_TEN',
  ExperienceLevel.moreThanTen: 'MORE_THAN_TEN',
};

const _$SessionFormatEnumMap = {
  SessionFormat.chat: 'chat',
  SessionFormat.audio: 'audio',
  SessionFormat.video: 'video',
};

const _$WorkStatusEnumMap = {
  WorkStatus.accepting: 'ACCEPTING',
  WorkStatus.busy: 'BUSY',
  WorkStatus.notAccepting: 'NOT_ACCEPTING',
  WorkStatus.unavailable: 'UNAVAILABLE',
};
