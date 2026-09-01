/// Заявка на вывод средств (E7 задача 14) — форма PAN/срок/держатель/сумма,
/// клиентская валидация через `PayoutController.submit`. PAN не
/// логируется нигде (тот же принцип, что `add_card_screen.dart` клиента).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';
import '../state/payout_controller.dart';

class PayoutScreen extends ConsumerStatefulWidget {
  const PayoutScreen({super.key});

  @override
  ConsumerState<PayoutScreen> createState() => _PayoutScreenState();
}

class _PayoutScreenState extends ConsumerState<PayoutScreen> {
  final _amount = TextEditingController();
  final _pan = TextEditingController();
  final _expiry = TextEditingController();
  final _holderName = TextEditingController();

  @override
  void dispose() {
    _amount.dispose();
    _pan.dispose();
    _expiry.dispose();
    _holderName.dispose();
    super.dispose();
  }

  void _submit() {
    final amountTiyn =
        (double.tryParse(_amount.text.replaceAll(',', '.')) ?? 0) * 100;
    ref
        .read(payoutControllerProvider.notifier)
        .submit(
          amountTiyn: amountTiyn.round(),
          pan: _pan.text,
          expiry: _expiry.text,
          holderName: _holderName.text.trim(),
        );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final state = ref.watch(payoutControllerProvider);

    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.payoutScreenTitle)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: ListView(
          children: [
            if (state.result != null)
              Container(
                padding: const EdgeInsets.all(16),
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: SqColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(SqRadius.m),
                ),
                child: Text(switch (state.result!.status) {
                  PayoutStatus.pendingReview => l10n.payoutPendingReview,
                  PayoutStatus.processing => l10n.payoutProcessing,
                  PayoutStatus.paid => l10n.payoutPaid,
                  PayoutStatus.rejected => l10n.payoutRejected(
                    state.result!.rejectReason ?? '',
                  ),
                }, style: SqTypography.body),
              ),
            TextField(
              key: const Key('sq-payout-amount'),
              controller: _amount,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(labelText: l10n.payoutAmountLabel),
            ),
            const SizedBox(height: 12),
            TextField(
              key: const Key('sq-payout-pan'),
              controller: _pan,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(labelText: l10n.payoutPanLabel),
            ),
            const SizedBox(height: 12),
            TextField(
              key: const Key('sq-payout-expiry'),
              controller: _expiry,
              decoration: const InputDecoration(labelText: 'MM/YY'),
            ),
            const SizedBox(height: 12),
            TextField(
              key: const Key('sq-payout-holder'),
              controller: _holderName,
              decoration: InputDecoration(labelText: l10n.payoutHolderLabel),
            ),
            if (state.validationError != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(switch (state.validationError!) {
                  PayoutValidationError.amountTooLow =>
                    l10n.payoutErrorAmountTooLow,
                  PayoutValidationError.invalidPan =>
                    l10n.payoutErrorInvalidPan,
                  PayoutValidationError.invalidExpiry =>
                    l10n.payoutErrorInvalidExpiry,
                }, style: SqTypography.body.copyWith(color: SqColors.danger)),
              ),
            if (state.errorMessage != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  state.errorMessage!,
                  style: SqTypography.body.copyWith(color: SqColors.danger),
                ),
              ),
            const SizedBox(height: 16),
            ElevatedButton(
              key: const Key('sq-payout-submit'),
              onPressed: state.submitting ? null : _submit,
              child: Text(l10n.actionSubmitPayout),
            ),
          ],
        ),
      ),
    );
  }
}
