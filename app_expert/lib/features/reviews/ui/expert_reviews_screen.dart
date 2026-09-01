/// Отзывы о текущем эксперте (E7 задача 15): средняя оценка и распределение
/// сверху, лента отзывов ниже, у каждого — «Ответить» и «Пожаловаться».
/// Данные берутся из `GET /experts/me/reviews` (приватная выдача владельцу
/// с `id` отзыва — публичная анонимная его не отдаёт).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';
import '../state/expert_reviews_controller.dart';
import 'review_item_card.dart';
import 'review_text_dialog.dart';

class ExpertReviewsScreen extends ConsumerWidget {
  const ExpertReviewsScreen({super.key});

  Future<void> _reply(
    BuildContext context,
    WidgetRef ref,
    OwnReviewItem review,
  ) async {
    final l10n = AppLocalizations.of(context)!;
    final text = await showDialog<String>(
      context: context,
      builder: (_) => ReviewTextDialog(
        title: l10n.reviewReplyDialogTitle,
        hint: l10n.reviewReplyHint,
        confirmLabel: l10n.actionSave,
        initialText: review.expertReply,
      ),
    );
    if (text == null || !context.mounted) return;
    await _run(
      context,
      () => ref
          .read(expertReviewsControllerProvider.notifier)
          .reply(review.id, text),
      l10n.reviewReplySaved,
    );
  }

  Future<void> _complaint(
    BuildContext context,
    WidgetRef ref,
    OwnReviewItem review,
  ) async {
    final l10n = AppLocalizations.of(context)!;
    final text = await showDialog<String>(
      context: context,
      builder: (_) => ReviewTextDialog(
        title: l10n.reviewComplaintDialogTitle,
        hint: l10n.reviewComplaintHint,
        confirmLabel: l10n.reviewActionComplaint,
      ),
    );
    if (text == null || !context.mounted) return;
    await _run(
      context,
      () => ref
          .read(expertReviewsControllerProvider.notifier)
          .complaint(review.id, text),
      l10n.reviewComplaintSent,
    );
  }

  /// Общая обвязка: сообщение об успехе или текст ошибки бэкенда. Ловим
  /// только `ApiException` — прочие сбои это баг приложения, глушить их
  /// snackbar'ом нельзя (тот же принцип, что в `offers_list_screen.dart`).
  Future<void> _run(
    BuildContext context,
    Future<void> Function() action,
    String successMessage,
  ) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      await action();
      messenger.showSnackBar(SnackBar(content: Text(successMessage)));
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

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
        data: (reviews) {
          final summary = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
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
                    style: SqTypography.body.copyWith(
                      color: SqColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ],
          );

          final list = Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (reviews.items.isEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 24),
                  child: Center(
                    child: Text(l10n.reviewsEmpty, style: SqTypography.body),
                  ),
                )
              else
                for (final review in reviews.items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: ReviewItemCard(
                      review: review,
                      onReply: () => _reply(context, ref, review),
                      onComplaint: () => _complaint(context, ref, review),
                    ),
                  ),
            ],
          );

          // Прототип `Expert Web - Рейтинг`: сводка колонкой 340 px
          // СЛЕВА, отзывы справа. На телефоне порядок прежний — сводка
          // сверху, список под ней.
          if (SqLayoutScope.of(context).isWide) {
            return SqSplitLayout(
              asideWidth: 340,
              asideFirst: true,
              aside: summary,
              main: list,
            );
          }

          return RefreshIndicator(
            onRefresh: () =>
                ref.read(expertReviewsControllerProvider.notifier).refresh(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [summary, const SizedBox(height: 16), list],
            ),
          );
        },
      ),
    );
  }
}
