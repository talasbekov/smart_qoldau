/// Отзывы клиента о консультации.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/providers.dart';

class ReviewsRepository {
  const ReviewsRepository(this._api);

  final SqApi _api;

  /// `POST /v1/consultations/{id}/review`.
  ///
  /// [publicText] попадает в анонимную ленту специалиста, [privateText]
  /// виден только команде качества (специалисту — никогда).
  Future<ReviewCreated> create(
    String consultationId, {
    required int rating,
    String? publicText,
    String? privateText,
  }) => _api.createReview(
    consultationId,
    rating: rating,
    publicText: publicText,
    privateText: privateText,
  );

  /// `DELETE /v1/reviews/{id}` — удалить свой отзыв (ТЗ §5.7). Использует
  /// задача 17: идентификатор берётся из ответа на создание.
  Future<void> delete(String reviewId) => _api.deleteReview(reviewId);
}

final reviewsRepositoryProvider = Provider<ReviewsRepository>(
  (ref) => ReviewsRepository(ref.watch(sqApiProvider)),
);
