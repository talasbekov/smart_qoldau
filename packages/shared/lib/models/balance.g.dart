// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'balance.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_BalanceDto _$BalanceDtoFromJson(Map<String, dynamic> json) => _BalanceDto(
  balanceTiyn: (json['balanceTiyn'] as num).toInt(),
  availableTiyn: (json['availableTiyn'] as num).toInt(),
);

Map<String, dynamic> _$BalanceDtoToJson(_BalanceDto instance) =>
    <String, dynamic>{
      'balanceTiyn': instance.balanceTiyn,
      'availableTiyn': instance.availableTiyn,
    };
