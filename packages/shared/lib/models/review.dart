import 'package:freezed_annotation/freezed_annotation.dart';

part 'review.freezed.dart';
part 'review.g.dart';

/// Созданный отзыв (`ReviewCreatedDto`, ответ `POST
/// /consultations/{id}/review`).
///
/// `privateText` здесь ОТСУТСТВУЕТ намеренно: бэкенд собирает этот DTO
/// явным перечислением полей и приватный текст автору не возвращает — он
/// виден только сотрудникам через админ-API. Модель повторяет контракт 1:1.
///
/// [id] нужен, чтобы клиент мог удалить свой отзыв (`DELETE /reviews/{id}`,
/// ТЗ §5.7): отдельного эндпоинта «мой отзыв по консультации» у бэкенда
/// нет, и другого способа узнать идентификатор не существует.
@freezed
abstract class ReviewCreated with _$ReviewCreated {
  const factory ReviewCreated({
    required String id,
    required String consultationId,
    required int rating,
    String? publicText,
    @Default(<String>[]) List<String> tags,
    required DateTime createdAt,
  }) = _ReviewCreated;

  factory ReviewCreated.fromJson(Map<String, dynamic> json) =>
      _$ReviewCreatedFromJson(json);
}

/// Один отзыв в публичной ленте эксперта (`ReviewItemDto`). Автор анонимен —
/// у бэкенда в этом DTO нет ни имени, ни id клиента.
@freezed
abstract class ReviewItem with _$ReviewItem {
  const factory ReviewItem({
    required int rating,
    String? publicText,
    String? expertReply,

    /// Коды тегов из [reviewTagsFor]; подписи живут в локализации клиента.
    @Default(<String>[]) List<String> tags,
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

/// Один СВОЙ отзыв в ленте эксперта (`OwnReviewItemDto`, ответ `GET
/// /experts/me/reviews`).
///
/// Отличается от [ReviewItem] ровно одним полем — [id]. Публичная выдача
/// `GET /experts/{id}/reviews` анонимна и идентификатор не отдаёт вообще
/// (см. комментарий `ReviewItemDto` на бэкенде), поэтому вызвать
/// `POST /reviews/{id}/reply|complaint` по ней было нечем — под это
/// бэкенд и завёл отдельный эндпоинт «свои отзывы». Автор отзыва здесь
/// по-прежнему анонимен: ни имени, ни кода клиента в DTO нет.
@freezed
abstract class OwnReviewItem with _$OwnReviewItem {
  const factory OwnReviewItem({
    required String id,
    required int rating,
    String? publicText,
    String? expertReply,

    /// Коды тегов из [reviewTagsFor]; подписи живут в локализации.
    @Default(<String>[]) List<String> tags,
    required DateTime createdAt,
  }) = _OwnReviewItem;

  factory OwnReviewItem.fromJson(Map<String, dynamic> json) =>
      _$OwnReviewItemFromJson(json);
}

/// Свои отзывы эксперта постранично + распределение и агрегаты
/// (`MyExpertReviewsDto`, ответ `GET /experts/me/reviews`). Аналог
/// [ExpertReviews], но элементы — [OwnReviewItem] с `id`.
@freezed
abstract class MyExpertReviews with _$MyExpertReviews {
  const factory MyExpertReviews({
    required List<OwnReviewItem> items,
    required RatingDistribution distribution,
    required double ratingAvg,
    required int ratingCount,
  }) = _MyExpertReviews;

  factory MyExpertReviews.fromJson(Map<String, dynamic> json) =>
      _$MyExpertReviewsFromJson(json);
}
