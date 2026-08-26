// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'premium_status.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PremiumStatus _$PremiumStatusFromJson(Map<String, dynamic> json) =>
    _PremiumStatus(
      active: json['active'] as bool,
      cancelled: json['cancelled'] as bool,
      inGrace: json['inGrace'] as bool,
      plan: $enumDecodeNullable(_$PremiumPlanEnumMap, json['plan']),
      currentPeriodEnd: json['currentPeriodEnd'] == null
          ? null
          : DateTime.parse(json['currentPeriodEnd'] as String),
    );

Map<String, dynamic> _$PremiumStatusToJson(_PremiumStatus instance) =>
    <String, dynamic>{
      'active': instance.active,
      'cancelled': instance.cancelled,
      'inGrace': instance.inGrace,
      'plan': _$PremiumPlanEnumMap[instance.plan],
      'currentPeriodEnd': instance.currentPeriodEnd?.toIso8601String(),
    };

const _$PremiumPlanEnumMap = {
  PremiumPlan.month: 'MONTH',
  PremiumPlan.year: 'YEAR',
};
