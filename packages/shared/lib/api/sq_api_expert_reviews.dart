import '../models/models.dart';
import 'sq_api_base.dart';
import 'sq_endpoints.dart';

/// Свои отзывы эксперта: лента с `id`, ответ на отзыв и жалоба на него
/// (E7 задача 15).
///
/// Отдельный миксин, а не пара методов в `SqApiExperts`: тот описывает
/// публичный каталог, доступный анонимному клиенту, а здесь — приватная
/// выдача владельцу профиля, где у отзыва есть идентификатор.
mixin SqApiExpertReviews on SqApiBase {
  /// `GET /experts/me/reviews` — свои отзывы (только PUBLISHED) с `id`
  /// каждого, распределение оценок и агрегаты.
  Future<MyExpertReviews> myReviews({int? take, int? skip}) => guard(() async {
        final response = await dio.get<Map<String, dynamic>>(
          SqEndpoints.expertsMeReviews,
          queryParameters: {
            'take': ?take,
            'skip': ?skip,
          },
        );
        return MyExpertReviews.fromJson(response.data!);
      });

  /// `POST /reviews/{id}/reply` — публичный ответ эксперта на отзыв.
  /// Повторный вызов перезаписывает предыдущий ответ. Тело — до 1000
  /// символов; `404 REVIEW_NOT_FOUND` — чужой или несуществующий отзыв,
  /// `409 INVALID_STATE_TRANSITION` — отзыв не в статусе PUBLISHED.
  Future<void> replyToReview(String reviewId, String text) => guard(() async {
        await dio.post<void>(
          SqEndpoints.reviewReply(reviewId),
          data: {'text': text},
        );
      });

  /// `POST /reviews/{id}/complaint` — жалоба эксперта на отзыв: отзыв
  /// уходит в FLAGGED и скрывается из публичной выдачи до решения
  /// модератора, поэтому после успеха ленту нужно перечитать.
  Future<void> complainAboutReview(String reviewId, String text) =>
      guard(() async {
        await dio.post<void>(
          SqEndpoints.reviewComplaint(reviewId),
          data: {'text': text},
        );
      });
}
