/// Меню сессии консультации.
///
/// Пункта «Сообщить о проблеме» здесь пока нет: тикеты появляются в задаче
/// 19. Показывать его заранее неактивным значило бы дать клиенту в кризисе
/// кнопку, которая ничего не делает.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../../l10n/app_localizations.dart';

class SessionMenu extends StatelessWidget {
  const SessionMenu({
    super.key,
    required this.onCancel,
    this.onEscalate,
    this.enabled = true,
  });

  final Future<void> Function() onCancel;

  /// Эскалация формата (чат → аудио → видео). `null` — экран, которому
  /// эскалация не нужна (например, сам звонок).
  final void Function(SessionFormat format)? onEscalate;

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
