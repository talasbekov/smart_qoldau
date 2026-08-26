/// Раскладка сессии: видео и чат.
///
/// По прототипу `Expert Web - Видеоконсультация`: на широком экране видео
/// занимает основную площадь, справа — панель чата 320 px. Психолог во
/// время сессии смотрит и на лицо, и на переписку; переключаться между
/// двумя экранами посреди разговора нельзя.
///
/// На телефоне раскладка прежняя: чат — отдельный экран, потому что рядом
/// с видео он там не помещается.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

/// Ширина панели из прототипа. На планшете столько же означало бы треть
/// экрана под переписку, поэтому там панель уже.
const double _chatPanelWidthDesktop = 320;
const double _chatPanelWidthTablet = 260;

class SessionLayout extends StatelessWidget {
  const SessionLayout({super.key, required this.media, required this.chat});

  final Widget media;
  final Widget chat;

  @override
  Widget build(BuildContext context) {
    final layout = SqLayoutScope.of(context);
    if (!layout.isWide) return media;

    final width = layout == SqLayout.desktop
        ? _chatPanelWidthDesktop
        : _chatPanelWidthTablet;

    return Row(
      children: [
        Expanded(child: media),
        SizedBox(
          key: const Key('sq-session-chat-panel'),
          width: width,
          child: DecoratedBox(
            decoration: const BoxDecoration(
              color: SqColors.surface,
              border: Border(left: BorderSide(color: SqColors.border)),
            ),
            child: chat,
          ),
        ),
      ],
    );
  }
}
