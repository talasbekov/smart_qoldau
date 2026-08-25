// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'photo_upload_result.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_PhotoUploadedDto _$PhotoUploadedDtoFromJson(Map<String, dynamic> json) =>
    _PhotoUploadedDto(
      status: $enumDecode(_$ProfileFieldStatusEnumMap, json['status']),
    );

Map<String, dynamic> _$PhotoUploadedDtoToJson(_PhotoUploadedDto instance) =>
    <String, dynamic>{'status': _$ProfileFieldStatusEnumMap[instance.status]!};

const _$ProfileFieldStatusEnumMap = {
  ProfileFieldStatus.none: 'NONE',
  ProfileFieldStatus.pending: 'PENDING',
  ProfileFieldStatus.approved: 'APPROVED',
  ProfileFieldStatus.rejected: 'REJECTED',
};
