// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'booking.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Slot _$SlotFromJson(Map<String, dynamic> json) =>
    _Slot(startAt: DateTime.parse(json['startAt'] as String));

Map<String, dynamic> _$SlotToJson(_Slot instance) => <String, dynamic>{
  'startAt': instance.startAt.toIso8601String(),
};

_BookingResult _$BookingResultFromJson(Map<String, dynamic> json) =>
    _BookingResult(
      consultationId: json['consultationId'] as String,
      startedAt: DateTime.parse(json['startedAt'] as String),
      status: $enumDecode(_$ConsultationStatusEnumMap, json['status']),
      paymentStatus: $enumDecode(
        _$ConsultationPaymentStatusEnumMap,
        json['paymentStatus'],
      ),
    );

Map<String, dynamic> _$BookingResultToJson(
  _BookingResult instance,
) => <String, dynamic>{
  'consultationId': instance.consultationId,
  'startedAt': instance.startedAt.toIso8601String(),
  'status': _$ConsultationStatusEnumMap[instance.status]!,
  'paymentStatus': _$ConsultationPaymentStatusEnumMap[instance.paymentStatus]!,
};

const _$ConsultationStatusEnumMap = {
  ConsultationStatus.scheduled: 'SCHEDULED',
  ConsultationStatus.active: 'ACTIVE',
  ConsultationStatus.completed: 'COMPLETED',
  ConsultationStatus.cancelled: 'CANCELLED',
};

const _$ConsultationPaymentStatusEnumMap = {
  ConsultationPaymentStatus.unpaid: 'UNPAID',
  ConsultationPaymentStatus.held: 'HELD',
  ConsultationPaymentStatus.captured: 'CAPTURED',
  ConsultationPaymentStatus.voided: 'VOIDED',
  ConsultationPaymentStatus.failed: 'FAILED',
};
