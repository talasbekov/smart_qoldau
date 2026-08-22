/// Шапка сессии: специалист, его статус и оставшееся время консультации.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../../l10n/app_localizations.dart';

/// `mm:ss` оставшегося времени.
String formatRemaining(Duration remaining) {
  final minutes = remaining.inMinutes.toString().padLeft(2, '0');
  final seconds = (remaining.inSeconds % 60).toString().padLeft(2, '0');
  return '$minutes:$seconds';
}

class SessionHeader extends StatelessWidget implements PreferredSizeWidget {
  const SessionHeader({
    super.key,
    required this.expertName,
    required this.remaining,
    required this.menu,
  });

  final String expertName;
  final Duration remaining;

  /// Меню сессии (`SessionMenu`) — передаётся снаружи, чтобы шапка не знала
  /// ни про контроллер, ни про навигацию.
  final Widget menu;

  @override
  Size get preferredSize => const Size.fromHeight(64);

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return AppBar(
      toolbarHeight: 64,
      title: Row(
        children: [
          SqAvatar(name: expertName, size: 36),
          const SizedBox(width: SqSpacing.m),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(expertName, style: SqTypography.title),
                Text(
                  // Ноль — плановое время вышло. Сессию это не закрывает:
                  // исход фиксирует специалист (БП-03), поэтому здесь
                  // сообщение, а не «-01:20».
                  remaining == Duration.zero
                      ? l10n.sessionTimeUp
                      : l10n.sessionRemaining(formatRemaining(remaining)),
                  style: SqTypography.caption.copyWith(
                    color: remaining == Duration.zero
                        ? SqColors.danger
                        : SqColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      actions: [menu],
    );
  }
}
