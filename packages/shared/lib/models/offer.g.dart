// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'offer.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_OfferDto _$OfferDtoFromJson(Map<String, dynamic> json) => _OfferDto(
  offerId: json['offerId'] as String,
  topicSlug: json['topicSlug'] as String,
  format: $enumDecode(_$SessionFormatEnumMap, json['format']),
  isEmergency: json['isEmergency'] as bool,
  clientCode: (json['clientCode'] as num).toInt(),
  deadlineAt: DateTime.parse(json['deadlineAt'] as String),
);

Map<String, dynamic> _$OfferDtoToJson(_OfferDto instance) => <String, dynamic>{
  'offerId': instance.offerId,
  'topicSlug': instance.topicSlug,
  'format': _$SessionFormatEnumMap[instance.format]!,
  'isEmergency': instance.isEmergency,
  'clientCode': instance.clientCode,
  'deadlineAt': instance.deadlineAt.toIso8601String(),
};

const _$SessionFormatEnumMap = {
  SessionFormat.chat: 'chat',
  SessionFormat.audio: 'audio',
  SessionFormat.video: 'video',
};

_AcceptOfferDto _$AcceptOfferDtoFromJson(Map<String, dynamic> json) =>
    _AcceptOfferDto(
      requestId: json['requestId'] as String,
      status: $enumDecode(_$RequestStatusEnumMap, json['status']),
      consultationId: json['consultationId'] as String,
    );

Map<String, dynamic> _$AcceptOfferDtoToJson(_AcceptOfferDto instance) =>
    <String, dynamic>{
      'requestId': instance.requestId,
      'status': _$RequestStatusEnumMap[instance.status]!,
      'consultationId': instance.consultationId,
    };

const _$RequestStatusEnumMap = {
  RequestStatus.searching: 'SEARCHING',
  RequestStatus.matched: 'MATCHED',
  RequestStatus.cancelled: 'CANCELLED',
  RequestStatus.noExperts: 'NO_EXPERTS',
  RequestStatus.callbackRequested: 'CALLBACK_REQUESTED',
};
