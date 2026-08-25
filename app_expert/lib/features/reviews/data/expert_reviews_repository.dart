/// Свои отзывы эксперта: лента, ответ и жалоба (E7 задача 15).
///
/// Раньше здесь был публичный `GET /experts/{id}/reviews`, а
/// «Ответить»/«Пожаловаться» были невозможны: публичная выдача
/// (`ReviewItemDto`) полностью анонимна и `id` отзыва не несёт вообще, а
/// `POST /reviews/{id}/reply|complaint` без него не вызвать. Бэкенд-долг
/// закрыт эндпоинтом `GET /experts/me/reviews` (`MyExpertReviewsDto`,
/// items с `id`) — на него репозиторий и переведён.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

class ExpertReviewsRepository {
  const ExpertReviewsRepository(this._api);

  final SqApi _api;

  /// `GET /experts/me/reviews` — свои отзывы (PUBLISHED) с `id`,
  /// распределение оценок и агрегаты.
  Future<MyExpertReviews> reviews({int? take, int? skip}) =>
      _api.myReviews(take: take, skip: skip);

  /// `POST /reviews/{id}/reply` — публичный ответ на отзыв; повтор
  /// перезаписывает предыдущий текст.
  Future<void> reply(String reviewId, String text) =>
      _api.replyToReview(reviewId, text);

  /// `POST /reviews/{id}/complaint` — жалоба: отзыв уходит в FLAGGED и
  /// пропадает из выдачи (и из рейтинга) до решения модератора.
  Future<void> complaint(String reviewId, String text) =>
      _api.complainAboutReview(reviewId, text);
}

final expertReviewsRepositoryProvider = Provider<ExpertReviewsRepository>(
  (ref) => ExpertReviewsRepository(ref.watch(sqApiProvider)),
);
