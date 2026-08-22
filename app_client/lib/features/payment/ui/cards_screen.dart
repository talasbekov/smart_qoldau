/// Экран привязанных карт клиента: список, добавление и открепление.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../state/cards_controller.dart';

class CardsScreen extends ConsumerWidget {
  const CardsScreen({super.key});

  Future<void> _confirmDelete(
    BuildContext context,
    WidgetRef ref,
    PaymentMethod card,
  ) async {
    final l10n = AppLocalizations.of(context)!;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.cardDeleteTitle),
        content: Text(l10n.cardDeleteBody(card.maskedPan)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(l10n.actionCancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(l10n.actionDelete),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await ref.read(cardsControllerProvider.notifier).remove(card.id);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final cards = ref.watch(cardsControllerProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.cardsTitle)),
      body: SafeArea(
        child: cards.when(
          loading: () => const Center(child: SqLoader()),
          error: (error, stackTrace) => Center(
            child: Padding(
              padding: const EdgeInsets.all(SqSpacing.l),
              child: SqErrorView(
                text: error is ApiException
                    ? errorText(context, error)
                    : l10n.errorGeneric,
                onRetry: () =>
                    ref.read(cardsControllerProvider.notifier).reload(),
                retryLabel: l10n.actionRetry,
              ),
            ),
          ),
          data: (list) => ListView(
            padding: const EdgeInsets.all(SqSpacing.l),
            children: [
              if (list.isEmpty)
                SqEmptyState(
                  icon: Icons.credit_card_off_outlined,
                  title: l10n.cardsEmpty,
                )
              else
                for (final card in list)
                  SqCard(
                    child: Row(
                      children: [
                        const Icon(
                          Icons.credit_card,
                          color: SqColors.primary,
                        ),
                        const SizedBox(width: SqSpacing.m),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(card.maskedPan, style: SqTypography.title),
                              Text(
                                card.brand,
                                style: SqTypography.caption.copyWith(
                                  color: SqColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          key: Key('sq-card-delete-${card.id}'),
                          icon: const Icon(
                            Icons.delete_outline,
                            color: SqColors.danger,
                          ),
                          onPressed: () => _confirmDelete(context, ref, card),
                        ),
                      ],
                    ),
                  ),
              const SizedBox(height: SqSpacing.l),
              SqButton(
                key: const Key('sq-cards-add'),
                label: l10n.paymentAddCard,
                onPressed: () => context.push(RoutePaths.cardsAdd),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
