// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'payment.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PaymentMethod _$PaymentMethodFromJson(Map<String, dynamic> json) =>
    _PaymentMethod(
      id: json['id'] as String,
      maskedPan: json['maskedPan'] as String,
      brand: json['brand'] as String,
      holderName: json['holderName'] as String,
    );

Map<String, dynamic> _$PaymentMethodToJson(_PaymentMethod instance) =>
    <String, dynamic>{
      'id': instance.id,
      'maskedPan': instance.maskedPan,
      'brand': instance.brand,
      'holderName': instance.holderName,
    };

_PaymentStatusInfo _$PaymentStatusInfoFromJson(Map<String, dynamic> json) =>
    _PaymentStatusInfo(
      status: $enumDecode(_$PaymentStatusEnumMap, json['status']),
      amountTiyn: (json['amountTiyn'] as num).toInt(),
      maskedPan: json['maskedPan'] as String,
    );

Map<String, dynamic> _$PaymentStatusInfoToJson(_PaymentStatusInfo instance) =>
    <String, dynamic>{
      'status': _$PaymentStatusEnumMap[instance.status]!,
      'amountTiyn': instance.amountTiyn,
      'maskedPan': instance.maskedPan,
    };

const _$PaymentStatusEnumMap = {
  PaymentStatus.pending: 'PENDING',
  PaymentStatus.held: 'HELD',
  PaymentStatus.captured: 'CAPTURED',
  PaymentStatus.voided: 'VOIDED',
  PaymentStatus.failed: 'FAILED',
};

_PayResult _$PayResultFromJson(Map<String, dynamic> json) =>
    _PayResult(status: $enumDecode(_$PaymentStatusEnumMap, json['status']));

Map<String, dynamic> _$PayResultToJson(_PayResult instance) =>
    <String, dynamic>{'status': _$PaymentStatusEnumMap[instance.status]!};
