/// Профиль специалиста и лента его отзывов.
library;

import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../data/catalog_repository.dart';

/// Сколько отзывов тянем за раз.
const expertReviewsPageSize = 10;

class ExpertProfileState {
  const ExpertProfileState({
    required this.expert,
    required this.reviews,
    required this.distribution,
    this.loadingMore = false,
    this.hasMore = false,
  });

  final ExpertPublic expert;

  /// Накопленная лента публичных отзывов.
  final List<ReviewItem> reviews;

  final RatingDistribution distribution;
  final bool loadingMore;
  final bool hasMore;

  ExpertProfileState copyWith({
    List<ReviewItem>? reviews,
    bool? loadingMore,
    bool? hasMore,
  }) => ExpertProfileState(
    expert: expert,
    reviews: reviews ?? this.reviews,
    distribution: distribution,
    loadingMore: loadingMore ?? this.loadingMore,
    hasMore: hasMore ?? this.hasMore,
  );
}

class ExpertController
    extends AutoDisposeFamilyAsyncNotifier<ExpertProfileState, String> {
  @override
  FutureOr<ExpertProfileState> build(String arg) => _load();

  Future<ExpertProfileState> _load() async {
    final repo = ref.read(catalogRepositoryProvider);
    final expert = await repo.expert(arg);
    final page = await repo.reviews(arg, take: expertReviewsPageSize, skip: 0);

    return ExpertProfileState(
      expert: expert,
      reviews: page.items,
      distribution: page.distribution,
      // Признака «есть ещё» у бэкенда нет (`ExpertReviewsDto` — items +
      // агрегаты), поэтому судим по общему числу отзывов: их количество
      // приходит в том же ответе.
      hasMore: page.items.length < page.ratingCount,
    );
  }

  Future<void> retry() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(_load);
  }

  /// Догружает следующую страницу отзывов.
  Future<void> loadMoreReviews() async {
    final current = state.valueOrNull;
    if (current == null || current.loadingMore || !current.hasMore) return;

    state = AsyncData(current.copyWith(loadingMore: true));
    try {
      final page = await ref
          .read(catalogRepositoryProvider)
          .reviews(
            arg,
            take: expertReviewsPageSize,
            skip: current.reviews.length,
          );
      final reviews = [...current.reviews, ...page.items];
      state = AsyncData(
        current.copyWith(
          reviews: reviews,
          loadingMore: false,
          hasMore: page.items.isNotEmpty && reviews.length < page.ratingCount,
        ),
      );
    } catch (error) {
      developer.log(
        'догрузка отзывов не удалась: ${error.runtimeType}',
        name: 'ExpertController',
      );
      state = AsyncData(current.copyWith(loadingMore: false));
    }
  }
}

final expertControllerProvider =
    AsyncNotifierProvider.autoDispose.family<
      ExpertController,
      ExpertProfileState,
      String
    >(ExpertController.new);
