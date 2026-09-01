/// Развилка по виду материала: у статьи, аудио и дыхания разные экраны, а
/// маршрут один — вид известен только после загрузки карточки.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/error_text.dart';
import '../../../l10n/app_localizations.dart';
import '../state/content_controller.dart';
import 'article_screen.dart';
import 'breathing_screen.dart';
import 'player_screen.dart';

class ContentRouterScreen extends ConsumerWidget {
  const ContentRouterScreen({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final item = ref.watch(contentItemProvider(id));

    return item.when(
      loading: () => const Scaffold(
        backgroundColor: SqColors.background,
        body: Center(child: SqLoader()),
      ),
      error: (error, _) => Scaffold(
        backgroundColor: SqColors.background,
        appBar: AppBar(),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(SqSpacing.l),
            child: SqErrorView(
              text: error is ApiException
                  ? errorText(context, error)
                  : l10n.errorGeneric,
              onRetry: () => ref.invalidate(contentItemProvider(id)),
              retryLabel: l10n.actionRetry,
            ),
          ),
        ),
      ),
      data: (data) {
        switch (data.kind) {
          case ContentKind.article:
            return ArticleScreen(id: id);
          case ContentKind.breathing:
            return BreathingScreen(id: id);
          case ContentKind.meditation:
          case ContentKind.music:
            return PlayerScreen(id: id);
        }
      },
    );
  }
}
