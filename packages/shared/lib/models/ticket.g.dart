// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ticket.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_TicketSummary _$TicketSummaryFromJson(Map<String, dynamic> json) =>
    _TicketSummary(
      id: json['id'] as String,
      category: json['category'] as String,
      subject: json['subject'] as String,
      status: json['status'] as String,
      team: json['team'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );

Map<String, dynamic> _$TicketSummaryToJson(_TicketSummary instance) =>
    <String, dynamic>{
      'id': instance.id,
      'category': instance.category,
      'subject': instance.subject,
      'status': instance.status,
      'team': instance.team,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

_TicketDetail _$TicketDetailFromJson(Map<String, dynamic> json) =>
    _TicketDetail(
      id: json['id'] as String,
      category: json['category'] as String,
      subject: json['subject'] as String,
      status: json['status'] as String,
      team: json['team'] as String,
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
      'category': instance.category,
      'subject': instance.subject,
      'status': instance.status,
      'team': instance.team,
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
      authorKind: json['authorKind'] as String,
      body: json['body'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$TicketMessageToJson(_TicketMessage instance) =>
    <String, dynamic>{
      'id': instance.id,
      'authorKind': instance.authorKind,
      'body': instance.body,
      'createdAt': instance.createdAt.toIso8601String(),
    };
