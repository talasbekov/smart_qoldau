// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'earnings.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_EarningsItemDto _$EarningsItemDtoFromJson(Map<String, dynamic> json) =>
    _EarningsItemDto(
      consultationId: json['consultationId'] as String,
      priceTiyn: (json['priceTiyn'] as num).toInt(),
      commissionTiyn: (json['commissionTiyn'] as num).toInt(),
      netTiyn: (json['netTiyn'] as num).toInt(),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$EarningsItemDtoToJson(_EarningsItemDto instance) =>
    <String, dynamic>{
      'consultationId': instance.consultationId,
      'priceTiyn': instance.priceTiyn,
      'commissionTiyn': instance.commissionTiyn,
      'netTiyn': instance.netTiyn,
      'createdAt': instance.createdAt.toIso8601String(),
    };

_EarningsDto _$EarningsDtoFromJson(Map<String, dynamic> json) => _EarningsDto(
  balanceTiyn: (json['balanceTiyn'] as num).toInt(),
  items: (json['items'] as List<dynamic>)
      .map((e) => EarningsItemDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$EarningsDtoToJson(_EarningsDto instance) =>
    <String, dynamic>{
      'balanceTiyn': instance.balanceTiyn,
      'items': instance.items.map((e) => e.toJson()).toList(),
    };
