import 'package:freezed_annotation/freezed_annotation.dart';

part 'ticket.freezed.dart';
part 'ticket.g.dart';

/// Строка списка обращений в поддержку (`TicketSummaryDto`).
///
/// `category`/`status`/`team` у бэкенда — настоящие Prisma-enum'ы
/// (`TicketCategory`, `TicketStatus`, `TicketTeam`), но задача не заводит под
/// них отдельные Dart-enum'ы (их нет в перечне enum'ов брифа задачи 4) —
/// значения хранятся строками как есть.
@freezed
abstract class TicketSummary with _$TicketSummary {
  const factory TicketSummary({
    required String id,
    required String category,
    required String subject,
    required String status,
    required String team,
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
    required String category,
    required String subject,
    required String status,
    required String team,
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

/// Сообщение переписки обращения (`TicketMessageDto`). `authorKind` —
/// `user`/`staff`, у бэкенда обычная строка, не enum.
@freezed
abstract class TicketMessage with _$TicketMessage {
  const factory TicketMessage({
    required String id,
    required String authorKind,
    required String body,
    required DateTime createdAt,
  }) = _TicketMessage;

  factory TicketMessage.fromJson(Map<String, dynamic> json) =>
      _$TicketMessageFromJson(json);
}
