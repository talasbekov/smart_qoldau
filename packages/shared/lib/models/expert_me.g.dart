// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'expert_me.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ExpertMe _$ExpertMeFromJson(Map<String, dynamic> json) => _ExpertMe(
  id: json['id'] as String,
  displayName: json['displayName'] as String,
  city: json['city'] as String,
  experience: $enumDecode(_$ExperienceLevelEnumMap, json['experience']),
  education: json['education'] as String,
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
  verificationStatus: $enumDecode(
    _$VerificationStatusEnumMap,
    json['verificationStatus'],
  ),
  workStatus: $enumDecode(_$WorkStatusEnumMap, json['workStatus']),
  isBlocked: json['isBlocked'] as bool,
  acceptsUrgent: json['acceptsUrgent'] as bool,
  photoUrl: json['photoUrl'] as String?,
  photoStatus: $enumDecode(_$ProfileFieldStatusEnumMap, json['photoStatus']),
  about: json['about'] as String?,
  aboutStatus: $enumDecode(_$ProfileFieldStatusEnumMap, json['aboutStatus']),
  moderationComment: json['moderationComment'] as String?,
);

Map<String, dynamic> _$ExpertMeToJson(_ExpertMe instance) => <String, dynamic>{
  'id': instance.id,
  'displayName': instance.displayName,
  'city': instance.city,
  'experience': _$ExperienceLevelEnumMap[instance.experience]!,
  'education': instance.education,
  'priceTiyn': instance.priceTiyn,
  'languages': instance.languages,
  'formats': instance.formats.map((e) => _$SessionFormatEnumMap[e]!).toList(),
  'topicSlugs': instance.topicSlugs,
  'verificationStatus':
      _$VerificationStatusEnumMap[instance.verificationStatus]!,
  'workStatus': _$WorkStatusEnumMap[instance.workStatus]!,
  'isBlocked': instance.isBlocked,
  'acceptsUrgent': instance.acceptsUrgent,
  'photoUrl': instance.photoUrl,
  'photoStatus': _$ProfileFieldStatusEnumMap[instance.photoStatus]!,
  'about': instance.about,
  'aboutStatus': _$ProfileFieldStatusEnumMap[instance.aboutStatus]!,
  'moderationComment': instance.moderationComment,
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

const _$VerificationStatusEnumMap = {
  VerificationStatus.draft: 'DRAFT',
  VerificationStatus.pending: 'PENDING',
  VerificationStatus.verified: 'VERIFIED',
};

const _$WorkStatusEnumMap = {
  WorkStatus.accepting: 'ACCEPTING',
  WorkStatus.busy: 'BUSY',
  WorkStatus.notAccepting: 'NOT_ACCEPTING',
  WorkStatus.unavailable: 'UNAVAILABLE',
};

const _$ProfileFieldStatusEnumMap = {
  ProfileFieldStatus.none: 'NONE',
  ProfileFieldStatus.pending: 'PENDING',
  ProfileFieldStatus.approved: 'APPROVED',
  ProfileFieldStatus.rejected: 'REJECTED',
};
