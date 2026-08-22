// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'match_request.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_MatchRequest _$MatchRequestFromJson(Map<String, dynamic> json) =>
    _MatchRequest(
      id: json['id'] as String,
      status: $enumDecode(_$RequestStatusEnumMap, json['status']),
      isEmergency: json['isEmergency'] as bool,
      clientCode: (json['clientCode'] as num).toInt(),
      matchedExpert: json['matchedExpert'] == null
          ? null
          : ExpertPublic.fromJson(
              json['matchedExpert'] as Map<String, dynamic>,
            ),
      consultationId: json['consultationId'] as String?,
      hotlines: (json['hotlines'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
    );

Map<String, dynamic> _$MatchRequestToJson(_MatchRequest instance) =>
    <String, dynamic>{
      'id': instance.id,
      'status': _$RequestStatusEnumMap[instance.status]!,
      'isEmergency': instance.isEmergency,
      'clientCode': instance.clientCode,
      'matchedExpert': ?instance.matchedExpert?.toJson(),
      'consultationId': ?instance.consultationId,
      'hotlines': ?instance.hotlines,
    };

const _$RequestStatusEnumMap = {
  RequestStatus.searching: 'SEARCHING',
  RequestStatus.matched: 'MATCHED',
  RequestStatus.cancelled: 'CANCELLED',
  RequestStatus.noExperts: 'NO_EXPERTS',
  RequestStatus.callbackRequested: 'CALLBACK_REQUESTED',
};
