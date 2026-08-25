/// Карточка одного отзыва (E7 задача 15). Автор ПОЛНОСТЬЮ анонимен —
/// `ReviewItem` не несёт ни имени, ни кода клиента (см. `ReviewItemDto`
/// бэкенда, комментарий в исходнике). Без кнопок «Ответить»/«Пожаловаться»
/// — см. долг в `ExpertReviewsRepository`.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

class ReviewItemCard extends StatelessWidget {
  const ReviewItemCard({super.key, required this.review});

  final ReviewItem review;

  @override
  Widget build(BuildContext context) {
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
                  Text('Ваш ответ', style: SqTypography.caption.copyWith(color: SqColors.textSecondary)),
                  const SizedBox(height: 4),
                  Text(review.expertReply!, style: SqTypography.body),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
