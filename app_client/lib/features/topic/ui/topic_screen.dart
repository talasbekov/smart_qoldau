/// Заглушка экрана темы — регистрирует маршрут `/topic?slug=`, чтобы тап по
/// плитке темы на главной не падал. Настоящий экран (подтверждение темы +
/// выбор формата через `FormatSheet`) добавляет задача 10 эпика E6 в
/// `features/funnel/ui/topic_screen.dart` — она же переключит `/topic` на
/// себя и, вероятно, уберёт этот файл (см. отчёт задачи 7).
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

class TopicScreen extends StatelessWidget {
  const TopicScreen({super.key, this.slug});

  /// `slug` темы из query-параметра `/topic?slug=<slug>`. Выводится как
  /// есть (не переведённая строка) — это debug-подсказка заглушки, а не
  /// пользовательский текст.
  final String? slug;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: SqColors.background,
      body: Center(
        child: SqEmptyState(
          icon: Icons.construction_outlined,
          title: slug ?? l10n.stubSectionSubtitle,
          subtitle: l10n.stubSectionSubtitle,
        ),
      ),
    );
  }
}
