/// Подтверждение отмены консультации (БП-03).
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

/// `true` — пользователь подтвердил отмену.
///
/// [minutesUntilStart] — сколько минут осталось до начала плановой записи.
/// Если меньше двух часов, диалог предупреждает о счётчике отмен (Р-17):
/// клиент должен узнать последствие ДО нажатия, а не постфактум.
Future<bool> confirmCancelConsultation(
  BuildContext context, {
  int? minutesUntilStart,
}) async {
  final l10n = AppLocalizations.of(context)!;
  final isLate = minutesUntilStart != null && minutesUntilStart < 120;
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(l10n.sessionCancelTitle),
      // Прямая формулировка БП-03: клиент должен понимать, что время
      // освободится для другого человека, а не «просто отменяется».
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.sessionCancelBody),
          if (isLate) ...[
            const SizedBox(height: SqSpacing.m),
            Text(
              l10n.consultationCancelLateWarning,
              key: const Key('sq-cancel-late-warning'),
              style: SqTypography.caption.copyWith(color: SqColors.danger),
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: Text(l10n.actionClose),
        ),
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          child: Text(
            l10n.sessionMenuCancel,
            style: const TextStyle(color: SqColors.danger),
          ),
        ),
      ],
    ),
  );
  return confirmed ?? false;
}
