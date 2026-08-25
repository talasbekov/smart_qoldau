/// Карточка одного своего отзыва (E7 задача 15). Автор ПОЛНОСТЬЮ анонимен —
/// `OwnReviewItem` не несёт ни имени, ни кода клиента (см. `OwnReviewItemDto`
/// бэкенда): `id` в нём появился только ради ответа и жалобы, PII-инвариант
/// не ослаблен.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

class ReviewItemCard extends StatelessWidget {
  const ReviewItemCard({
    super.key,
    required this.review,
    required this.onReply,
    required this.onComplaint,
  });

  final OwnReviewItem review;
  final VoidCallback onReply;
  final VoidCallback onComplaint;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: SqColors.surface,
        borderRadius: BorderRadius.circular(SqRadius.m),
        border: Border.all(color: SqColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: List.generate(
              5,
              (i) => Icon(
                i < review.rating ? Icons.star : Icons.star_border,
                size: 18,
                color: SqColors.primary,
              ),
            ),
          ),
          if (review.publicText != null) ...[
            const SizedBox(height: 8),
            Text(review.publicText!, style: SqTypography.body),
          ],
          if (review.expertReply != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: SqColors.surfaceMuted,
                borderRadius: BorderRadius.circular(SqRadius.s),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.reviewYourReply, style: SqTypography.caption.copyWith(color: SqColors.textSecondary)),
                  const SizedBox(height: 4),
                  Text(review.expertReply!, style: SqTypography.body),
                ],
              ),
            ),
          ],
          const SizedBox(height: 8),
          Row(
            children: [
              TextButton(
                key: Key('sq-review-reply-${review.id}'),
                onPressed: onReply,
                child: Text(
                  review.expertReply == null
                      ? l10n.reviewActionReply
                      : l10n.reviewActionEditReply,
                ),
              ),
              const Spacer(),
              TextButton(
                key: Key('sq-review-complaint-${review.id}'),
                onPressed: onComplaint,
                child: Text(
                  l10n.reviewActionComplaint,
                  style: SqTypography.body.copyWith(color: SqColors.danger),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
