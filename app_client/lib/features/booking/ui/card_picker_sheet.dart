/// Выбор карты для записи на слот (E6b).
///
/// Отдельная шторка, а не PaymentSheet: та оплачивает уже созданную
/// консультацию, а здесь холд делает сам `POST /bookings` — консультации
/// ещё нет.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';
import '../../payment/state/cards_controller.dart';

/// Возвращает id выбранной карты или `null`, если пользователь передумал.
Future<String?> showCardPickerSheet(
  BuildContext context,
  String confirmLabel,
) => showSqSheetOrDialog<String>(
  context: context,
  backgroundColor: SqColors.surface,
  shape: const RoundedRectangleBorder(
    borderRadius: BorderRadius.vertical(top: Radius.circular(SqRadius.l)),
  ),
  builder: (sheetContext) => _CardPickerSheet(confirmLabel: confirmLabel),
);

class _CardPickerSheet extends ConsumerStatefulWidget {
  const _CardPickerSheet({required this.confirmLabel});

  final String confirmLabel;

  @override
  ConsumerState<_CardPickerSheet> createState() => _CardPickerSheetState();
}

class _CardPickerSheetState extends ConsumerState<_CardPickerSheet> {
  String? _selected;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final cards = ref.watch(cardsControllerProvider);

    return Padding(
      padding: const EdgeInsets.all(SqSpacing.l),
      child: cards.when(
        loading: () => const Padding(
          padding: EdgeInsets.all(SqSpacing.l),
          child: Center(child: SqLoader()),
        ),
        error: (error, stackTrace) => Text(l10n.errorGeneric),
        data: (list) {
          final selected =
              _selected ?? (list.isNotEmpty ? list.first.id : null);
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(l10n.bookingChooseCard, style: SqTypography.title),
              const SizedBox(height: SqSpacing.m),
              RadioGroup<String>(
                groupValue: selected,
                onChanged: (value) => setState(() => _selected = value),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (final card in list)
                      RadioListTile<String>(
                        key: Key('sq-booking-card-${card.id}'),
                        value: card.id,
                        title: Text(card.maskedPan, style: SqTypography.body),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: SqSpacing.m),
              SqButton(
                key: const Key('sq-booking-confirm'),
                label: widget.confirmLabel,
                onPressed: selected == null
                    ? null
                    : () => Navigator.of(context).pop(selected),
              ),
            ],
          );
        },
      ),
    );
  }
}
