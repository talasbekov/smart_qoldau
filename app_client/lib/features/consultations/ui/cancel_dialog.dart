/// Подтверждение отмены консультации (БП-03).
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

/// `true` — пользователь подтвердил отмену.
Future<bool> confirmCancelConsultation(BuildContext context) async {
  final l10n = AppLocalizations.of(context)!;
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(l10n.sessionCancelTitle),
      // Прямая формулировка БП-03: клиент должен понимать, что время
      // освободится для другого человека, а не «просто отменяется».
      content: Text(l10n.sessionCancelBody),
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
