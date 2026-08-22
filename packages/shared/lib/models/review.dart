import 'package:freezed_annotation/freezed_annotation.dart';

part 'review.freezed.dart';
part 'review.g.dart';

/// Один отзыв в публичной ленте эксперта (`ReviewItemDto`). Автор анонимен —
/// у бэкенда в этом DTO нет ни имени, ни id клиента.
@freezed
abstract class ReviewItem with _$ReviewItem {
  const factory ReviewItem({
    required int rating,
    String? publicText,
    String? expertReply,
    required DateTime createdAt,
  }) = _ReviewItem;

  factory ReviewItem.fromJson(Map<String, dynamic> json) =>
      _$ReviewItemFromJson(json);
}

/// Распределение оценок 1..5 (`RatingDistributionDto`). Бэкенд отдаёт
/// числовые ключи `"1".."5"` прямо как поля объекта (см.
/// `backend/src/reviews/dto/expert-reviews.dto.ts`) — `@JsonKey` перекладывает
/// их в именованные Dart-поля `rating1`..`rating5`.
@freezed
abstract class RatingDistribution with _$RatingDistribution {
  const factory RatingDistribution({
    @JsonKey(name: '1') required int rating1,
    @JsonKey(name: '2') required int rating2,
    @JsonKey(name: '3') required int rating3,
    @JsonKey(name: '4') required int rating4,
    @JsonKey(name: '5') required int rating5,
  }) = _RatingDistribution;

  factory RatingDistribution.fromJson(Map<String, dynamic> json) =>
      _$RatingDistributionFromJson(json);
}

/// Отзывы эксперта постранично + распределение и агрегаты
/// (`ExpertReviewsDto`).
@freezed
abstract class ExpertReviews with _$ExpertReviews {
  const factory ExpertReviews({
    required List<ReviewItem> items,
    required RatingDistribution distribution,
    required double ratingAvg,
    required int ratingCount,
  }) = _ExpertReviews;

  factory ExpertReviews.fromJson(Map<String, dynamic> json) =>
      _$ExpertReviewsFromJson(json);
}
