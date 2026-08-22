import 'package:freezed_annotation/freezed_annotation.dart';

part 'topic.freezed.dart';
part 'topic.g.dart';

/// Тема консультации из справочника (`TopicDto` бэкенда, `GET /topics`).
@freezed
abstract class Topic with _$Topic {
  const factory Topic({
    required String id,
    required String slug,
    required String name,
  }) = _Topic;

  factory Topic.fromJson(Map<String, dynamic> json) => _$TopicFromJson(json);
}
