import 'package:freezed_annotation/freezed_annotation.dart';

part 'chat_message.freezed.dart';
part 'chat_message.g.dart';

/// Сообщение чата консультации (`MessageDto` бэкенда). `senderRole` —
/// `client`/`expert`; у бэкенда это обычная строка, не enum (`@ApiProperty
/// ({enum: ['client','expert']})` без TS-типа), поэтому модель не заводит
/// под него отдельный Dart-тип.
@freezed
abstract class ChatMessage with _$ChatMessage {
  const factory ChatMessage({
    required String id,
    required String consultationId,
    required String senderRole,
    required String text,
    required DateTime createdAt,
  }) = _ChatMessage;

  factory ChatMessage.fromJson(Map<String, dynamic> json) =>
      _$ChatMessageFromJson(json);
}

/// Страница истории сообщений (`MessageHistoryDto` бэкенда).
@freezed
abstract class MessageHistory with _$MessageHistory {
  const factory MessageHistory({
    required List<ChatMessage> items,
    String? nextCursor,
  }) = _MessageHistory;

  factory MessageHistory.fromJson(Map<String, dynamic> json) =>
      _$MessageHistoryFromJson(json);
}
