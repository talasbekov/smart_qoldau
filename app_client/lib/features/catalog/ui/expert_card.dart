/// Карточка специалиста в списке, распределение оценок и элемент ленты
/// отзывов — общие кусочки каталога и профиля.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';
import '../../payment/ui/found_screen.dart' show experienceLabel;

/// Карточка специалиста в каталоге и в избранном.
class ExpertCard extends StatelessWidget {
  const ExpertCard({
    super.key,
    required this.expert,
    required this.onTap,
    required this.isFavorite,
    required this.onToggleFavorite,
  });

  final ExpertPublic expert;
  final VoidCallback onTap;
  final bool isFavorite;
  final VoidCallback onToggleFavorite;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Padding(
      padding: const EdgeInsets.only(bottom: SqSpacing.m),
      child: InkWell(
        key: Key('sq-expert-card-${expert.id}'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(SqRadius.m),
        child: SqCard(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SqAvatar(name: expert.displayName, size: 48),
              const SizedBox(width: SqSpacing.m),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(expert.displayName, style: SqTypography.title),
                    const SizedBox(height: SqSpacing.xs),
                    Text(
                      '${expert.city} · '
                      '${experienceLabel(l10n, expert.experience)}',
                      style: SqTypography.caption.copyWith(
                        color: SqColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: SqSpacing.xs),
                    Row(
                      children: [
                        SqRatingStars(value: expert.ratingAvg),
                        const SizedBox(width: SqSpacing.s),
                        Text(
                          expert.ratingAvg.toStringAsFixed(1),
                          style: SqTypography.caption,
                        ),
                      ],
                    ),
                    const SizedBox(height: SqSpacing.xs),
                    Text(
                      formatTenge(expert.priceTiyn),
                      style: SqTypography.title,
                    ),
                  ],
                ),
              ),
              IconButton(
                key: Key('sq-expert-card-favorite-${expert.id}'),
                icon: Icon(
                  isFavorite ? Icons.favorite : Icons.favorite_border,
                  color: isFavorite
                      ? SqColors.danger
                      : SqColors.textSecondary,
                ),
                onPressed: onToggleFavorite,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Распределение оценок 1..5 полосками — из `RatingDistributionDto`.
class RatingDistributionView extends StatelessWidget {
  const RatingDistributionView({
    super.key,
    required this.distribution,
    required this.ratingAvg,
    required this.ratingCount,
  });

  final RatingDistribution distribution;
  final double ratingAvg;
  final int ratingCount;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final counts = <int, int>{
      5: distribution.rating5,
      4: distribution.rating4,
      3: distribution.rating3,
      2: distribution.rating2,
      1: distribution.rating1,
    };
    // Делим на максимум, а не на сумму: полоски сравнивают уровни между
    // собой, и при 260 из 312 остальные были бы неразличимы.
    final maxCount = counts.values.fold<int>(0, (a, b) => a > b ? a : b);

    return SqCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              SqRatingStars(value: ratingAvg),
              const SizedBox(width: SqSpacing.s),
              Text(ratingAvg.toStringAsFixed(1), style: SqTypography.title),
              const SizedBox(width: SqSpacing.s),
              Text(
                l10n.expertReviewsCount(ratingCount),
                style: SqTypography.caption.copyWith(
                  color: SqColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: SqSpacing.m),
          for (final entry in counts.entries)
            Padding(
              key: Key('sq-expert-distribution-${entry.key}'),
              padding: const EdgeInsets.only(bottom: SqSpacing.xs),
              child: Row(
                children: [
                  SizedBox(
                    width: 16,
                    child: Text('${entry.key}', style: SqTypography.caption),
                  ),
                  const SizedBox(width: SqSpacing.s),
                  Expanded(
                    child: LinearProgressIndicator(
                      value: maxCount == 0 ? 0 : entry.value / maxCount,
                      backgroundColor: SqColors.surfaceMuted,
                      color: SqColors.accent,
                    ),
                  ),
                  const SizedBox(width: SqSpacing.s),
                  Text('${entry.value}', style: SqTypography.caption),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Один отзыв в ленте специалиста. Автор анонимен — в `ReviewItemDto` его
/// вообще нет.
class ReviewItemView extends StatelessWidget {
  const ReviewItemView({super.key, required this.review});

  final ReviewItem review;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Padding(
      padding: const EdgeInsets.only(bottom: SqSpacing.m),
      child: SqCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SqRatingStars(value: review.rating.toDouble()),
            if (review.publicText != null) ...[
              const SizedBox(height: SqSpacing.s),
              Text(review.publicText!, style: SqTypography.body),
            ],
            if (review.expertReply != null) ...[
              const SizedBox(height: SqSpacing.s),
              Container(
                padding: const EdgeInsets.all(SqSpacing.m),
                decoration: BoxDecoration(
                  color: SqColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(SqRadius.s),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.expertReplyPrefix,
                      style: SqTypography.caption.copyWith(
                        color: SqColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: SqSpacing.xs),
                    Text(review.expertReply!, style: SqTypography.body),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
