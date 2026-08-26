/// Шторка оплаты консультации: сумма, выбор карты и эскроу-холд (Р-01).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import '../../premium/state/premium_controller.dart';
import '../state/cards_controller.dart';
import '../state/payment_controller.dart';

/// Показывает шторку оплаты для [consultation]. Возвращает `true`, если
/// деньги захолдированы.
Future<bool?> showPaymentSheet(
  BuildContext context,
  ClientConsultation consultation,
) => showModalBottomSheet<bool>(
  context: context,
  isScrollControlled: true,
  backgroundColor: SqColors.surface,
  shape: const RoundedRectangleBorder(
    borderRadius: BorderRadius.vertical(top: Radius.circular(SqRadius.l)),
  ),
  builder: (sheetContext) => PaymentSheet(
    consultation: consultation,
    onPaid: () => Navigator.of(sheetContext).pop(true),
  ),
);

class PaymentSheet extends ConsumerStatefulWidget {
  const PaymentSheet({super.key, required this.consultation, this.onPaid});

  final ClientConsultation consultation;

  /// Вызывается ровно один раз, когда холд подтверждён. `null` — шторка
  /// показана вне модального контекста (например, в тесте): тогда она
  /// просто остаётся на месте.
  final VoidCallback? onPaid;

  @override
  ConsumerState<PaymentSheet> createState() => _PaymentSheetState();
}

class _PaymentSheetState extends ConsumerState<PaymentSheet> {
  String? _selectedCardId;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final cards = ref.watch(cardsControllerProvider);
    final payment = ref.watch(paymentControllerProvider);

    ref.listen(paymentControllerProvider, (previous, next) {
      if (next.phase == PaymentPhase.paid) widget.onPaid?.call();
      // Карта исчезла на бэкенде — список карт устарел, перечитываем.
      if (next.cardsStale) ref.invalidate(cardsControllerProvider);
    });

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(SqSpacing.l),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.paymentSheetTitle,
              style: SqTypography.h2,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: SqSpacing.l),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(l10n.paymentLineItem, style: SqTypography.title),
                      const SizedBox(height: SqSpacing.xs),
                      Text(
                        l10n.paymentDuration(
                          widget.consultation.plannedDurationMin,
                        ),
                        style: SqTypography.body.copyWith(
                          color: SqColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  formatTenge(widget.consultation.priceTiyn),
                  style: SqTypography.h2,
                ),
              ],
            ),
            const SizedBox(height: SqSpacing.m),
            const _PremiumLine(),
            const SizedBox(height: SqSpacing.m),
            cards.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(SqSpacing.l),
                child: SqLoader(),
              ),
              error: (error, stackTrace) => SqErrorView(
                text: error is ApiException
                    ? errorText(context, error)
                    : l10n.errorGeneric,
                onRetry: () =>
                    ref.read(cardsControllerProvider.notifier).reload(),
                retryLabel: l10n.actionRetry,
              ),
              data: (list) => _CardsList(
                cards: list,
                selectedId:
                    _selectedCardId ?? (list.isEmpty ? null : list.first.id),
                onSelect: (id) => setState(() => _selectedCardId = id),
              ),
            ),
            const SizedBox(height: SqSpacing.m),
            TextButton(
              key: const Key('sq-payment-add-card'),
              onPressed: () => context.push(RoutePaths.cardsAdd),
              child: Text(l10n.paymentAddCard),
            ),
            const SizedBox(height: SqSpacing.s),
            Text(
              l10n.paymentEscrowNote,
              style: SqTypography.caption.copyWith(
                color: SqColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
            if (payment.phase == PaymentPhase.declined) ...[
              const SizedBox(height: SqSpacing.m),
              Text(
                l10n.paymentDeclinedTitle,
                style: SqTypography.title.copyWith(color: SqColors.danger),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: SqSpacing.xs),
              Text(
                // Текст провайдера точнее общего словаря — показываем его,
                // а к словарю падаем только когда своего текста нет.
                payment.providerMessage ??
                    _codeText(context, payment.errorCode, l10n),
                style: SqTypography.body.copyWith(color: SqColors.danger),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: SqSpacing.m),
              Row(
                children: [
                  Expanded(
                    child: SqButton(
                      key: const Key('sq-payment-retry'),
                      label: l10n.actionRetry,
                      onPressed: () => _pay(),
                    ),
                  ),
                  const SizedBox(width: SqSpacing.m),
                  Expanded(
                    child: SqButton(
                      key: const Key('sq-payment-another-card'),
                      kind: SqButtonKind.secondary,
                      label: l10n.paymentAnotherCard,
                      onPressed: () =>
                          ref.read(paymentControllerProvider.notifier).reset(),
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: SqSpacing.l),
            SqButton(
              key: const Key('sq-payment-pay'),
              label: l10n.paymentPay,
              loading: payment.phase == PaymentPhase.processing,
              onPressed: _canPay(cards.valueOrNull, payment) ? _pay : null,
            ),
          ],
        ),
      ),
    );
  }

  bool _canPay(List<PaymentMethod>? cards, PaymentState payment) =>
      cards != null &&
      cards.isNotEmpty &&
      payment.phase != PaymentPhase.processing;

  void _pay() {
    final cards = ref.read(cardsControllerProvider).valueOrNull;
    if (cards == null || cards.isEmpty) return;
    final cardId = _selectedCardId ?? cards.first.id;
    ref
        .read(paymentControllerProvider.notifier)
        .pay(
          consultationId: widget.consultation.id,
          paymentMethodId: cardId,
          priceTiyn: widget.consultation.priceTiyn,
        );
  }
}

String _codeText(BuildContext context, String? code, AppLocalizations l10n) =>
    code == null
    ? l10n.errorGeneric
    : errorText(context, ApiException(code, '', 0));

class _CardsList extends StatelessWidget {
  const _CardsList({
    required this.cards,
    required this.selectedId,
    required this.onSelect,
  });

  final List<PaymentMethod> cards;
  final String? selectedId;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    if (cards.isEmpty) {
      return Text(
        l10n.paymentNoCards,
        style: SqTypography.body.copyWith(color: SqColors.textSecondary),
        textAlign: TextAlign.center,
      );
    }

    return Column(
      children: [
        for (final card in cards)
          ListTile(
            key: Key('sq-payment-card-${card.id}'),
            leading: Icon(
              selectedId == card.id
                  ? Icons.radio_button_checked
                  : Icons.radio_button_unchecked,
              color: SqColors.primary,
            ),
            title: Text(card.maskedPan, style: SqTypography.body),
            subtitle: Text(
              card.brand,
              style: SqTypography.caption.copyWith(
                color: SqColors.textSecondary,
              ),
            ),
            onTap: () => onSelect(card.id),
          ),
      ],
    );
  }
}

/// Строка Premium в шторке оплаты: базовому клиенту — предложение, у
/// подписчика — отметка, что скидка уже в цене.
///
/// Статус не загрузился — строки просто нет: оплата консультации не должна
/// зависеть от того, ответил ли эндпоинт подписки. Формулировку «без
/// оплаты за каждый сеанс» из веб-прототипа не используем: БП-07 прямо
/// отмечает её как вводящую в заблуждение — консультации платные и при
/// Premium.
class _PremiumLine extends ConsumerWidget {
  const _PremiumLine();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final status = ref.watch(premiumStatusProvider).valueOrNull;
    if (status == null) return const SizedBox.shrink();

    if (status.active) {
      return Row(
        children: [
          const Icon(
            Icons.check_circle_outline,
            size: 18,
            color: SqColors.primary,
          ),
          const SizedBox(width: SqSpacing.s),
          Expanded(
            child: Text(
              l10n.premiumDiscountApplied,
              style: SqTypography.caption.copyWith(color: SqColors.primary),
            ),
          ),
        ],
      );
    }

    return InkWell(
      key: const Key('sq-payment-premium-upsell'),
      onTap: () => context.push(RoutePaths.premium),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: SqSpacing.xs),
        child: Row(
          children: [
            const Icon(
              Icons.workspace_premium_outlined,
              size: 18,
              color: SqColors.primary,
            ),
            const SizedBox(width: SqSpacing.s),
            Expanded(
              child: Text(
                l10n.premiumUpsell,
                style: SqTypography.caption.copyWith(color: SqColors.primary),
              ),
            ),
            const Icon(
              Icons.chevron_right,
              size: 18,
              color: SqColors.textSecondary,
            ),
          ],
        ),
      ),
    );
  }
}
