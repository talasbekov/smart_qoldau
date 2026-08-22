// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'consultation.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ClientConsultation _$ClientConsultationFromJson(Map<String, dynamic> json) =>
    _ClientConsultation(
      id: json['id'] as String,
      status: $enumDecode(_$ConsultationStatusEnumMap, json['status']),
      outcome: $enumDecodeNullable(
        _$ConsultationOutcomeEnumMap,
        json['outcome'],
      ),
      format: $enumDecode(_$SessionFormatEnumMap, json['format']),
      isEmergency: json['isEmergency'] as bool,
      startedAt: DateTime.parse(json['startedAt'] as String),
      endedAt: json['endedAt'] == null
          ? null
          : DateTime.parse(json['endedAt'] as String),
      priceTiyn: (json['priceTiyn'] as num).toInt(),
      plannedDurationMin: (json['plannedDurationMin'] as num).toInt(),
      paymentStatus: $enumDecode(
        _$ConsultationPaymentStatusEnumMap,
        json['paymentStatus'],
      ),
      expert: ExpertPublic.fromJson(json['expert'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$ClientConsultationToJson(
  _ClientConsultation instance,
) => <String, dynamic>{
  'id': instance.id,
  'status': _$ConsultationStatusEnumMap[instance.status]!,
  'outcome': _$ConsultationOutcomeEnumMap[instance.outcome],
  'format': _$SessionFormatEnumMap[instance.format]!,
  'isEmergency': instance.isEmergency,
  'startedAt': instance.startedAt.toIso8601String(),
  'endedAt': instance.endedAt?.toIso8601String(),
  'priceTiyn': instance.priceTiyn,
  'plannedDurationMin': instance.plannedDurationMin,
  'paymentStatus': _$ConsultationPaymentStatusEnumMap[instance.paymentStatus]!,
  'expert': instance.expert.toJson(),
};

const _$ConsultationStatusEnumMap = {
  ConsultationStatus.active: 'ACTIVE',
  ConsultationStatus.completed: 'COMPLETED',
  ConsultationStatus.cancelled: 'CANCELLED',
};

const _$ConsultationOutcomeEnumMap = {
  ConsultationOutcome.completed: 'COMPLETED',
  ConsultationOutcome.clientNoShow: 'CLIENT_NO_SHOW',
  ConsultationOutcome.clientCancelled: 'CLIENT_CANCELLED',
  ConsultationOutcome.techIssue: 'TECH_ISSUE',
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
