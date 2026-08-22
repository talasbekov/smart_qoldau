/// Заглушка экрана «специалист найден» — регистрирует маршрут
/// `/found/:requestId`, на который уводит экран поиска, как только заявка
/// получила статус `MATCHED`. Настоящий экран (карточка специалиста,
/// подтверждение и оплата холдом) добавляет задача 12 эпика E6.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

class FoundScreen extends StatelessWidget {
  const FoundScreen({super.key, required this.requestId});

  /// Идентификатор заявки из пути. Выводится как есть — это debug-подсказка
  /// заглушки, а не пользовательский текст.
  final String requestId;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(),
      body: Center(
        child: SqEmptyState(
          icon: Icons.construction_outlined,
          title: requestId,
          subtitle: l10n.stubSectionSubtitle,
        ),
      ),
    );
  }
}
