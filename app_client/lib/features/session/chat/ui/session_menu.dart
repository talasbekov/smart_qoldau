/// Меню сессии консультации.
///
/// Пункты появлялись вместе со своей работой: аудио/видео — в задаче 14,
/// «Сообщить о проблеме» — в задаче 19. Заранее неактивных пунктов здесь
/// не было и быть не должно: кнопка, которая ничего не делает, хуже её
/// отсутствия.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../../l10n/app_localizations.dart';

class SessionMenu extends StatelessWidget {
  const SessionMenu({
    super.key,
    required this.onCancel,
    this.onEscalate,
    this.onReportProblem,
    this.enabled = true,
  });

  final Future<void> Function() onCancel;

  /// Эскалация формата (чат → аудио → видео). `null` — экран, которому
  /// эскалация не нужна (например, сам звонок).
  final void Function(SessionFormat format)? onEscalate;

  /// «Сообщить о проблеме» — обращение в поддержку с привязкой к этой
  /// консультации. `null` — экран, которому пункт не нужен.
  final VoidCallback? onReportProblem;

  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return PopupMenuButton<void>(
      key: const Key('sq-session-menu'),
      enabled: enabled,
      icon: const Icon(Icons.more_horiz),
      itemBuilder: (context) => [
        if (onEscalate != null) ...[
          PopupMenuItem<void>(
            onTap: () => onEscalate!(SessionFormat.audio),
            child: Text(l10n.sessionMenuAudio, style: SqTypography.body),
          ),
          PopupMenuItem<void>(
            onTap: () => onEscalate!(SessionFormat.video),
            child: Text(l10n.sessionMenuVideo, style: SqTypography.body),
          ),
        ],
        if (onReportProblem != null)
          PopupMenuItem<void>(
            onTap: onReportProblem,
            child: Text(l10n.sessionMenuReport, style: SqTypography.body),
          ),
        PopupMenuItem<void>(
          onTap: onCancel,
          child: Text(
            l10n.sessionMenuCancel,
            style: SqTypography.body.copyWith(color: SqColors.danger),
          ),
        ),
      ],
    );
  }
}
