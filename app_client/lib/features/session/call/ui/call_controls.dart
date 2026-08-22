/// Кнопки управления звонком: микрофон, камера, завершить.
///
/// Динамика (громкой связи) здесь нет: переключение аудиовыхода —
/// отдельная платформенная операция, которой нет в [CallEngine], и рисовать
/// нерабочую кнопку в звонке хуже, чем не рисовать её.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../../l10n/app_localizations.dart';

class CallControls extends StatelessWidget {
  const CallControls({
    super.key,
    required this.micEnabled,
    required this.camEnabled,
    required this.showCamera,
    required this.onToggleMic,
    required this.onToggleCam,
    required this.onEnd,
  });

  final bool micEnabled;
  final bool camEnabled;

  /// Камера показывается только в видеозвонке и только если доступ к ней
  /// есть — иначе кнопка обманывала бы пользователя.
  final bool showCamera;

  final VoidCallback onToggleMic;
  final VoidCallback onToggleCam;
  final VoidCallback onEnd;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Padding(
      padding: const EdgeInsets.all(SqSpacing.l),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _CircleAction(
            buttonKey: const Key('sq-call-mic'),
            icon: micEnabled ? Icons.mic : Icons.mic_off,
            label: l10n.callMic,
            onPressed: onToggleMic,
          ),
          if (showCamera)
            _CircleAction(
              buttonKey: const Key('sq-call-cam'),
              icon: camEnabled ? Icons.videocam : Icons.videocam_off,
              label: l10n.callCamera,
              onPressed: onToggleCam,
            ),
          _CircleAction(
            buttonKey: const Key('sq-call-end'),
            icon: Icons.call_end,
            label: l10n.callEnd,
            color: SqColors.danger,
            onPressed: onEnd,
          ),
        ],
      ),
    );
  }
}

class _CircleAction extends StatelessWidget {
  const _CircleAction({
    required this.buttonKey,
    required this.icon,
    required this.label,
    required this.onPressed,
    this.color,
  });

  final Key buttonKey;
  final IconData icon;
  final String label;
  final VoidCallback onPressed;
  final Color? color;

  @override
  Widget build(BuildContext context) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      IconButton.filled(
        key: buttonKey,
        onPressed: onPressed,
        icon: Icon(icon),
        style: color == null
            ? null
            : IconButton.styleFrom(backgroundColor: color),
      ),
      const SizedBox(height: SqSpacing.xs),
      Text(
        label,
        style: SqTypography.caption.copyWith(color: SqColors.textSecondary),
      ),
    ],
  );
}
