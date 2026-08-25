/// Отзывы о текущем эксперте (E7 задача 15): средняя оценка и
/// распределение сверху, лента отзывов ниже. «Ответить»/«Пожаловаться» из
/// брифа задачи НЕ реализованы — см. долг в `ExpertReviewsRepository`
/// (заведён в Plane, проект Smart Qoldau, Backlog).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../state/expert_reviews_controller.dart';
import 'review_item_card.dart';

class ExpertReviewsScreen extends ConsumerWidget {
  const ExpertReviewsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(expertReviewsControllerProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: const Text('Отзывы')),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Text(
            error is ApiException ? error.message : 'Не удалось загрузить отзывы',
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
                    '${reviews.ratingCount} отзывов',
                    style: SqTypography.body.copyWith(color: SqColors.textSecondary),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (reviews.items.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 24),
                  child: Center(child: Text('Пока нет отзывов', style: SqTypography.body)),
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
