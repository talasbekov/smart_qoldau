// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'consultation_expert.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ConsultationExpertDto _$ConsultationExpertDtoFromJson(
  Map<String, dynamic> json,
) => _ConsultationExpertDto(
  id: json['id'] as String,
  status: $enumDecode(_$ConsultationStatusEnumMap, json['status']),
  outcome: $enumDecodeNullable(_$ConsultationOutcomeEnumMap, json['outcome']),
  format: $enumDecode(_$SessionFormatEnumMap, json['format']),
  isEmergency: json['isEmergency'] as bool,
  startedAt: DateTime.parse(json['startedAt'] as String),
  endedAt: json['endedAt'] == null
      ? null
      : DateTime.parse(json['endedAt'] as String),
  clientCode: (json['clientCode'] as num).toInt(),
  topicSlug: json['topicSlug'] as String,
  priceTiyn: (json['priceTiyn'] as num).toInt(),
  plannedDurationMin: (json['plannedDurationMin'] as num).toInt(),
  paymentStatus: $enumDecode(
    _$ConsultationPaymentStatusEnumMap,
    json['paymentStatus'],
  ),
);

Map<String, dynamic> _$ConsultationExpertDtoToJson(
  _ConsultationExpertDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'status': _$ConsultationStatusEnumMap[instance.status]!,
  'outcome': _$ConsultationOutcomeEnumMap[instance.outcome],
  'format': _$SessionFormatEnumMap[instance.format]!,
  'isEmergency': instance.isEmergency,
  'startedAt': instance.startedAt.toIso8601String(),
  'endedAt': instance.endedAt?.toIso8601String(),
  'clientCode': instance.clientCode,
  'topicSlug': instance.topicSlug,
  'priceTiyn': instance.priceTiyn,
  'plannedDurationMin': instance.plannedDurationMin,
  'paymentStatus': _$ConsultationPaymentStatusEnumMap[instance.paymentStatus]!,
};

const _$ConsultationStatusEnumMap = {
  ConsultationStatus.scheduled: 'SCHEDULED',
  ConsultationStatus.active: 'ACTIVE',
  ConsultationStatus.completed: 'COMPLETED',
  ConsultationStatus.cancelled: 'CANCELLED',
};

const _$ConsultationOutcomeEnumMap = {
  ConsultationOutcome.completed: 'COMPLETED',
  ConsultationOutcome.clientNoShow: 'CLIENT_NO_SHOW',
  ConsultationOutcome.clientCancelled: 'CLIENT_CANCELLED',
  ConsultationOutcome.techIssue: 'TECH_ISSUE',
  ConsultationOutcome.expertCancelled: 'EXPERT_CANCELLED',
};

const _$SessionFormatEnumMap = {
  SessionFormat.chat: 'chat',
  SessionFormat.audio: 'audio',
  SessionFormat.video: 'video',
};

const _$ConsultationPaymentStatusEnumMap = {
  ConsultationPaymentStatus.unpaid: 'UNPAID',
  ConsultationPaymentStatus.held: 'HELD',
  ConsultationPaymentStatus.captured: 'CAPTURED',
  ConsultationPaymentStatus.voided: 'VOIDED',
  ConsultationPaymentStatus.failed: 'FAILED',
};
