// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'expert_document.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_ExpertDocumentDto _$ExpertDocumentDtoFromJson(Map<String, dynamic> json) =>
    _ExpertDocumentDto(
      type: $enumDecode(_$DocumentTypeEnumMap, json['type']),
      status: $enumDecodeNullable(_$DocumentStatusEnumMap, json['status']),
      updatedAt: json['updatedAt'] == null
          ? null
          : DateTime.parse(json['updatedAt'] as String),
    );

Map<String, dynamic> _$ExpertDocumentDtoToJson(_ExpertDocumentDto instance) =>
    <String, dynamic>{
      'type': _$DocumentTypeEnumMap[instance.type]!,
      'status': _$DocumentStatusEnumMap[instance.status],
      'updatedAt': instance.updatedAt?.toIso8601String(),
    };

const _$DocumentTypeEnumMap = {
  DocumentType.identity: 'IDENTITY',
  DocumentType.diploma: 'DIPLOMA',
  DocumentType.certificates: 'CERTIFICATES',
  DocumentType.qualification: 'QUALIFICATION',
};

const _$DocumentStatusEnumMap = {
  DocumentStatus.uploaded: 'UPLOADED',
  DocumentStatus.approved: 'APPROVED',
  DocumentStatus.reuploadRequired: 'REUPLOAD_REQUIRED',
};

_SubmitVerificationDto _$SubmitVerificationDtoFromJson(
  Map<String, dynamic> json,
) => _SubmitVerificationDto(
  verificationStatus: $enumDecode(
    _$VerificationStatusEnumMap,
    json['verificationStatus'],
  ),
);

Map<String, dynamic> _$SubmitVerificationDtoToJson(
  _SubmitVerificationDto instance,
) => <String, dynamic>{
  'verificationStatus':
      _$VerificationStatusEnumMap[instance.verificationStatus]!,
};

const _$VerificationStatusEnumMap = {
  VerificationStatus.draft: 'DRAFT',
  VerificationStatus.pending: 'PENDING',
  VerificationStatus.verified: 'VERIFIED',
};
