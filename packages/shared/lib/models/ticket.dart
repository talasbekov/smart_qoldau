import 'package:freezed_annotation/freezed_annotation.dart';

import 'enums.dart';

part 'ticket.freezed.dart';
part 'ticket.g.dart';

/// Строка списка обращений в поддержку (`TicketSummaryDto`).
@freezed
abstract class TicketSummary with _$TicketSummary {
  const factory TicketSummary({
    required String id,
    required TicketCategory category,
    required String subject,
    required TicketStatus status,
    required TicketTeam team,
    required DateTime createdAt,
    required DateTime updatedAt,
  }) = _TicketSummary;

  factory TicketSummary.fromJson(Map<String, dynamic> json) =>
      _$TicketSummaryFromJson(json);
}

/// Обращение с перепиской (`TicketDetailDto`).
@freezed
abstract class TicketDetail with _$TicketDetail {
  const factory TicketDetail({
    required String id,
    required TicketCategory category,
    required String subject,
    required TicketStatus status,
    required TicketTeam team,
    required DateTime createdAt,
    required DateTime updatedAt,
    required String body,
    required DateTime? firstReplyAt,
    required DateTime? resolvedAt,
    required String? relatedConsultationId,
    required String? relatedPayoutId,
    required List<TicketMessage> messages,
  }) = _TicketDetail;

  factory TicketDetail.fromJson(Map<String, dynamic> json) =>
      _$TicketDetailFromJson(json);
}

/// Сообщение переписки обращения (`TicketMessageDto`).
@freezed
abstract class TicketMessage with _$TicketMessage {
  const factory TicketMessage({
    required String id,
    required TicketAuthorKind authorKind,
    required String body,
    required DateTime createdAt,
  }) = _TicketMessage;

  factory TicketMessage.fromJson(Map<String, dynamic> json) =>
      _$TicketMessageFromJson(json);
}
