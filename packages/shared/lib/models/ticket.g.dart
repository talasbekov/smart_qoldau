// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ticket.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_TicketSummary _$TicketSummaryFromJson(Map<String, dynamic> json) =>
    _TicketSummary(
      id: json['id'] as String,
      category: $enumDecode(_$TicketCategoryEnumMap, json['category']),
      subject: json['subject'] as String,
      status: $enumDecode(_$TicketStatusEnumMap, json['status']),
      team: $enumDecode(_$TicketTeamEnumMap, json['team']),
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );

Map<String, dynamic> _$TicketSummaryToJson(_TicketSummary instance) =>
    <String, dynamic>{
      'id': instance.id,
      'category': _$TicketCategoryEnumMap[instance.category]!,
      'subject': instance.subject,
      'status': _$TicketStatusEnumMap[instance.status]!,
      'team': _$TicketTeamEnumMap[instance.team]!,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

const _$TicketCategoryEnumMap = {
  TicketCategory.consultations: 'CONSULTATIONS',
  TicketCategory.payment: 'PAYMENT',
  TicketCategory.payouts: 'PAYOUTS',
  TicketCategory.technical: 'TECHNICAL',
  TicketCategory.verification: 'VERIFICATION',
  TicketCategory.security: 'SECURITY',
  TicketCategory.clientQuestion: 'CLIENT_QUESTION',
  TicketCategory.accountData: 'ACCOUNT_DATA',
  TicketCategory.other: 'OTHER',
};

const _$TicketStatusEnumMap = {
  TicketStatus.new_: 'NEW',
  TicketStatus.inProgress: 'IN_PROGRESS',
  TicketStatus.resolved: 'RESOLVED',
};

const _$TicketTeamEnumMap = {
  TicketTeam.supportOperator: 'SUPPORT_OPERATOR',
  TicketTeam.verificationOperator: 'VERIFICATION_OPERATOR',
  TicketTeam.financeControl: 'FINANCE_CONTROL',
  TicketTeam.qualityTeam: 'QUALITY_TEAM',
};

_TicketDetail _$TicketDetailFromJson(Map<String, dynamic> json) =>
    _TicketDetail(
      id: json['id'] as String,
      category: $enumDecode(_$TicketCategoryEnumMap, json['category']),
      subject: json['subject'] as String,
      status: $enumDecode(_$TicketStatusEnumMap, json['status']),
      team: $enumDecode(_$TicketTeamEnumMap, json['team']),
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      body: json['body'] as String,
      firstReplyAt: json['firstReplyAt'] == null
          ? null
          : DateTime.parse(json['firstReplyAt'] as String),
      resolvedAt: json['resolvedAt'] == null
          ? null
          : DateTime.parse(json['resolvedAt'] as String),
      relatedConsultationId: json['relatedConsultationId'] as String?,
      relatedPayoutId: json['relatedPayoutId'] as String?,
      messages: (json['messages'] as List<dynamic>)
          .map((e) => TicketMessage.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$TicketDetailToJson(_TicketDetail instance) =>
    <String, dynamic>{
      'id': instance.id,
      'category': _$TicketCategoryEnumMap[instance.category]!,
      'subject': instance.subject,
      'status': _$TicketStatusEnumMap[instance.status]!,
      'team': _$TicketTeamEnumMap[instance.team]!,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
      'body': instance.body,
      'firstReplyAt': instance.firstReplyAt?.toIso8601String(),
      'resolvedAt': instance.resolvedAt?.toIso8601String(),
      'relatedConsultationId': instance.relatedConsultationId,
      'relatedPayoutId': instance.relatedPayoutId,
      'messages': instance.messages.map((e) => e.toJson()).toList(),
    };

_TicketMessage _$TicketMessageFromJson(Map<String, dynamic> json) =>
    _TicketMessage(
      id: json['id'] as String,
      authorKind: $enumDecode(_$TicketAuthorKindEnumMap, json['authorKind']),
      body: json['body'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$TicketMessageToJson(_TicketMessage instance) =>
    <String, dynamic>{
      'id': instance.id,
      'authorKind': _$TicketAuthorKindEnumMap[instance.authorKind]!,
      'body': instance.body,
      'createdAt': instance.createdAt.toIso8601String(),
    };

const _$TicketAuthorKindEnumMap = {
  TicketAuthorKind.user: 'user',
  TicketAuthorKind.staff: 'staff',
};
