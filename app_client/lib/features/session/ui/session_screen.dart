/// Заглушка экрана сессии консультации — регистрирует маршрут
/// `/session/:id`, чтобы тап по баннеру активной консультации на главной не
/// падал. Настоящие экраны (чат — задача 13, звонок — задача 14 эпика E6, в
/// `features/session/{chat,call}`) и, вероятно, диспетчер по формату
/// консультации появятся здесь же.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

class SessionScreen extends StatelessWidget {
  const SessionScreen({super.key, required this.consultationId});

  /// Id консультации из `/session/:id`. Выводится как есть — debug-подсказка
  /// заглушки, а не пользовательский текст.
  final String consultationId;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: SqColors.background,
      // См. комментарий в `TopicScreen` — открывается через `context.push`
      // с главной (баннер активной консультации), поэтому нуждается в той
      // же стрелке возврата, что и остальные заглушки. Ревью раунда 1
      // задачи 7.
      appBar: AppBar(),
      body: Center(
        child: SqEmptyState(
          icon: Icons.construction_outlined,
          title: consultationId,
          subtitle: l10n.stubSectionSubtitle,
        ),
      ),
    );
  }
}
