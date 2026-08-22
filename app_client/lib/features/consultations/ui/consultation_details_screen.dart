/// Детали консультации: карточка, платёж и собственный отзыв.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../l10n/app_localizations.dart';
import '../data/consultations_repository.dart';
import '../state/consultations_controller.dart';
import 'consultation_card.dart';

/// Платёж консультации: `null` — платежа нет (обычная ветка для
/// неоплаченной консультации, `PAYMENT_NOT_FOUND` уже обработан
/// репозиторием).
final consultationPaymentProvider = FutureProvider.autoDispose
    .family<PaymentStatusInfo?, String>(
      (ref, id) => ref.read(consultationsRepositoryProvider).payment(id),
    );

class ConsultationDetailsScreen extends ConsumerWidget {
  const ConsultationDetailsScreen({super.key, required this.consultationId});

  final String consultationId;

  Future<void> _deleteReview(BuildContext context, WidgetRef ref) async {
    final l10n = AppLocalizations.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.reviewDeleteTitle),
        content: Text(l10n.reviewDeleteBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.actionClose),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(
              l10n.reviewDelete,
              style: const TextStyle(color: SqColors.danger),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await ref.read(myReviewControllerProvider(consultationId).notifier).delete();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final consultation = ref.watch(consultationProvider(consultationId));
    final payment = ref.watch(consultationPaymentProvider(consultationId));
    final myReview = ref.watch(myReviewControllerProvider(consultationId));

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.consultationDetailsTitle)),
      body: SafeArea(
        child: consultation.when(
          loading: () => const Center(child: SqLoader()),
          error: (error, stackTrace) => Center(
            child: Padding(
              padding: const EdgeInsets.all(SqSpacing.l),
              child: SqErrorView(
                text: error is ApiException
                    ? errorText(context, error)
                    : l10n.errorGeneric,
                onRetry: () =>
                    ref.invalidate(consultationProvider(consultationId)),
                retryLabel: l10n.actionRetry,
              ),
            ),
          ),
          data: (data) => ListView(
            padding: const EdgeInsets.all(SqSpacing.l),
            children: [
              SqCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        SqAvatar(name: data.expert.displayName, size: 48),
                        const SizedBox(width: SqSpacing.m),
                        Expanded(
                          child: Text(
                            data.expert.displayName,
                            style: SqTypography.title,
                          ),
                        ),
                        Text(
                          formatTenge(data.priceTiyn),
                          style: SqTypography.title,
                        ),
                      ],
                    ),
                    const SizedBox(height: SqSpacing.m),
                    Text(
                      formatAlmatyDateTime(data.startedAt),
                      style: SqTypography.body.copyWith(
                        color: SqColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: SqSpacing.xs),
                    Text(
                      data.outcome != null
                          ? consultationOutcomeLabel(l10n, data.outcome!)
                          : consultationStatusLabel(l10n, data.status),
                      style: SqTypography.body,
                    ),
                    const SizedBox(height: SqSpacing.xs),
                    Text(
                      paymentStatusLabel(l10n, data.paymentStatus),
                      style: SqTypography.body,
                    ),
                    // Карта показывается только когда платёж действительно
                    // есть: у неоплаченной консультации `GET /payment`
                    // отвечает 404, и это нормальный исход, а не ошибка.
                    if (payment.valueOrNull case final info?) ...[
                      const SizedBox(height: SqSpacing.xs),
                      Text(
                        l10n.paymentPaidWithCard(info.maskedPan),
                        key: const Key('sq-consultation-paid-card'),
                        style: SqTypography.body.copyWith(
                          color: SqColors.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (myReview.reviewId != null) ...[
                const SizedBox(height: SqSpacing.l),
                Text(l10n.myReviewTitle, style: SqTypography.title),
                const SizedBox(height: SqSpacing.s),
                SqButton(
                  key: const Key('sq-consultation-delete-review'),
                  kind: SqButtonKind.secondary,
                  label: l10n.reviewDelete,
                  loading: myReview.deleting,
                  onPressed: myReview.deleting
                      ? null
                      : () => _deleteReview(context, ref),
                ),
              ],
              if (myReview.errorCode != null) ...[
                const SizedBox(height: SqSpacing.m),
                Text(
                  errorText(context, ApiException(myReview.errorCode!, '', 0)),
                  key: const Key('sq-consultation-review-error'),
                  style: SqTypography.body.copyWith(color: SqColors.danger),
                  textAlign: TextAlign.center,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
