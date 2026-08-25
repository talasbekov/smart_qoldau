/// Лента своих отзывов эксперта с ответом и жалобой (E7 задача 15).
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/expert_reviews_repository.dart';

class ExpertReviewsController extends AsyncNotifier<MyExpertReviews> {
  @override
  FutureOr<MyExpertReviews> build() => _load();

  Future<MyExpertReviews> _load() =>
      ref.read(expertReviewsRepositoryProvider).reviews();

  Future<void> refresh() async {
    state = await AsyncValue.guard(_load);
  }

  /// Ответ на отзыв. Ошибку НЕ проглатываем и не кладём в `state` —
  /// экран показывает её точечно рядом с диалогом, а лента при этом
  /// остаётся видимой (иначе один неудачный ответ обнулял бы весь
  /// список до ошибки).
  Future<void> reply(String reviewId, String text) async {
    await ref.read(expertReviewsRepositoryProvider).reply(reviewId, text);
    await refresh();
  }

  /// Жалоба на отзыв. После успеха отзыв уходит в FLAGGED и исчезает из
  /// выдачи вместе с пересчитанным рейтингом — поэтому обязательно
  /// перечитываем ленту.
  Future<void> complaint(String reviewId, String text) async {
    await ref.read(expertReviewsRepositoryProvider).complaint(reviewId, text);
    await refresh();
  }
}

final expertReviewsControllerProvider =
    AsyncNotifierProvider<ExpertReviewsController, MyExpertReviews>(
  ExpertReviewsController.new,
);
