/// Шторка выбора формата консультации (чат / аудио / видео).
///
/// Прототип `08-topic.png` рисует формат тремя карточками прямо на экране
/// темы; бриф задачи 10 требует отдельную шторку `FormatSheet`. Сделано по
/// брифу: шторка — переиспользуемая точка выбора (её же зовёт каталог,
/// задача 16), а экран темы показывает выбранное значение строкой. Само
/// множество вариантов и подпись «50 минут» — из прототипа.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

/// Показывает шторку и возвращает выбранный формат — либо `null`, если
/// пользователь закрыл её, ничего не выбрав (обычный, не аварийный исход).
Future<SessionFormat?> showFormatSheet(BuildContext context) =>
    showModalBottomSheet<SessionFormat>(
      context: context,
      backgroundColor: SqColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(SqRadius.l)),
      ),
      builder: (context) => const _FormatSheet(),
    );

/// Локализованное название формата — общая точка правды для шторки и для
/// строки «выбран формат» на экране темы.
String formatLabel(AppLocalizations l10n, SessionFormat format) =>
    switch (format) {
      SessionFormat.chat => l10n.formatChat,
      SessionFormat.audio => l10n.formatAudio,
      SessionFormat.video => l10n.formatVideo,
    };

IconData _formatIcon(SessionFormat format) => switch (format) {
  SessionFormat.chat => Icons.chat_bubble_outline,
  SessionFormat.audio => Icons.headset_outlined,
  SessionFormat.video => Icons.videocam_outlined,
};

class _FormatSheet extends StatelessWidget {
  const _FormatSheet();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(SqSpacing.l),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.formatSheetTitle,
              style: SqTypography.h2,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: SqSpacing.m),
            for (final format in SessionFormat.values) ...[
              ListTile(
                key: Key('sq-format-${format.wireValue}'),
                leading: Icon(_formatIcon(format), color: SqColors.primary),
                title: Text(formatLabel(l10n, format), style: SqTypography.body),
                subtitle: Text(
                  l10n.formatSheetCaption,
                  style: SqTypography.caption.copyWith(
                    color: SqColors.textSecondary,
                  ),
                ),
                onTap: () => Navigator.of(context).pop(format),
              ),
              if (format != SessionFormat.values.last)
                const Divider(height: 1, color: SqColors.border),
            ],
          ],
        ),
      ),
    );
  }
}
