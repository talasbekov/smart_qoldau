/// Ветка «сейчас нет свободных специалистов» (`RequestStatus.noExperts`,
/// БП-01): заявка закрылась, не найдя никого подходящего.
///
/// Не отдельный маршрут, а содержимое экрана поиска: заявка уже создана и
/// её идентификатор остаётся в адресе — так системное «назад» и повторное
/// открытие ссылки ведут себя предсказуемо.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

class NoExpertsView extends StatelessWidget {
  const NoExpertsView({
    super.key,
    required this.onTryAgain,
    required this.onGoHome,
    this.busy = false,
  });

  /// `null` — пересоздать заявку нечем: экран открыт без темы и формата
  /// (прямая ссылка), и повторять на самом деле нечего.
  final VoidCallback? onTryAgain;
  final VoidCallback onGoHome;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(SqSpacing.l),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SqEmptyState(
              icon: Icons.person_search_outlined,
              title: l10n.noExpertsTitle,
              subtitle: l10n.noExpertsBody,
            ),
            const SizedBox(height: SqSpacing.xl),
            SqButton(
              key: const Key('sq-no-experts-retry'),
              label: l10n.actionTryAgain,
              loading: busy,
              onPressed: busy ? null : onTryAgain,
            ),
            const SizedBox(height: SqSpacing.m),
            SqButton(
              key: const Key('sq-no-experts-home'),
              label: l10n.actionGoHome,
              kind: SqButtonKind.secondary,
              onPressed: busy ? null : onGoHome,
            ),
          ],
        ),
      ),
    );
  }
}
