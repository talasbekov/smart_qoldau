/// Лента отзывов о текущем эксперте (E7 задача 15, урезано — см. долг в
/// `ExpertReviewsRepository`).
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/expert_reviews_repository.dart';

class ExpertReviewsController extends AsyncNotifier<ExpertReviews> {
  @override
  FutureOr<ExpertReviews> build() => _load();

  Future<ExpertReviews> _load() async {
    final repo = ref.read(expertReviewsRepositoryProvider);
    final expertId = await repo.myExpertId();
    return repo.reviews(expertId);
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(_load);
  }
}

final expertReviewsControllerProvider =
    AsyncNotifierProvider<ExpertReviewsController, ExpertReviews>(
  ExpertReviewsController.new,
);
