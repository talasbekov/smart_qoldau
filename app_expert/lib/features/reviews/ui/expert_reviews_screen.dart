/// Отзывы о текущем эксперте (E7 задача 15): средняя оценка и
/// распределение сверху, лента отзывов ниже. «Ответить»/«Пожаловаться» из
/// брифа задачи НЕ реализованы — см. долг в `ExpertReviewsRepository`
/// (заведён в Plane, проект Smart Qoldau, Backlog).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';
import '../state/expert_reviews_controller.dart';
import 'review_item_card.dart';

class ExpertReviewsScreen extends ConsumerWidget {
  const ExpertReviewsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final async = ref.watch(expertReviewsControllerProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.reviewsScreenTitle)),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Text(
            error is ApiException ? error.message : l10n.errorLoadFailed,
            style: SqTypography.body.copyWith(color: SqColors.danger),
          ),
        ),
        data: (reviews) => RefreshIndicator(
          onRefresh: () => ref.read(expertReviewsControllerProvider.notifier).refresh(),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Text(
                    reviews.ratingAvg.toStringAsFixed(1),
                    style: SqTypography.h1,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    l10n.reviewsCount(reviews.ratingCount),
                    style: SqTypography.body.copyWith(color: SqColors.textSecondary),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (reviews.items.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 24),
                  child: Center(child: Text(l10n.reviewsEmpty, style: SqTypography.body)),
                )
              else
                for (final review in reviews.items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: ReviewItemCard(review: review),
                  ),
            ],
          ),
        ),
      ),
    );
  }
}
