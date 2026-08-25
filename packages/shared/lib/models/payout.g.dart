// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'payout.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PayoutDto _$PayoutDtoFromJson(Map<String, dynamic> json) => _PayoutDto(
  id: json['id'] as String,
  amountTiyn: (json['amountTiyn'] as num).toInt(),
  maskedPan: json['maskedPan'] as String,
  status: $enumDecode(_$PayoutStatusEnumMap, json['status']),
  rejectReason: json['rejectReason'] as String?,
  createdAt: DateTime.parse(json['createdAt'] as String),
);

Map<String, dynamic> _$PayoutDtoToJson(_PayoutDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'amountTiyn': instance.amountTiyn,
      'maskedPan': instance.maskedPan,
      'status': _$PayoutStatusEnumMap[instance.status]!,
      'rejectReason': instance.rejectReason,
      'createdAt': instance.createdAt.toIso8601String(),
    };

const _$PayoutStatusEnumMap = {
  PayoutStatus.pendingReview: 'PENDING_REVIEW',
  PayoutStatus.processing: 'PROCESSING',
  PayoutStatus.paid: 'PAID',
  PayoutStatus.rejected: 'REJECTED',
};
