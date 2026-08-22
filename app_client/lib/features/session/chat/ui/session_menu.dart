/// Меню сессии консультации.
///
/// Пунктов «Перейти в аудио/видео» и «Сообщить о проблеме» здесь пока нет:
/// звонок появляется в задаче 14, тикеты — в задаче 19. Показывать их
/// заранее неактивными значило бы дать клиенту в кризисе кнопку, которая
/// ничего не делает, — они добавятся вместе со своей работой.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../../l10n/app_localizations.dart';

class SessionMenu extends StatelessWidget {
  const SessionMenu({super.key, required this.onCancel, this.enabled = true});

  final Future<void> Function() onCancel;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return PopupMenuButton<void>(
      key: const Key('sq-session-menu'),
      enabled: enabled,
      icon: const Icon(Icons.more_horiz),
      itemBuilder: (context) => [
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
