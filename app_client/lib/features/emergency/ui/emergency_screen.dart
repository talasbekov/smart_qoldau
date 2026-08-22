/// Заглушка экстренного сценария — регистрирует маршрут `/emergency`, чтобы
/// тап по красной кнопке «Мне нужна помощь сейчас» на главной не падал.
/// Настоящий сценарий (`ScreeningScreen` → `DangerScreen`/поиск,
/// `HotlinesScreen`, Р-16) добавляет задача 11 эпика E6, которая же заменит
/// этот маршрут своими экранами.
library;

import 'package:flutter/material.dart';
import 'package:shared/shared.dart';

import '../../../l10n/app_localizations.dart';

class EmergencyScreen extends StatelessWidget {
  const EmergencyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      backgroundColor: SqColors.background,
      appBar: AppBar(title: Text(l10n.homeEmergencyCta)),
      body: Center(
        child: SqEmptyState(
          icon: Icons.construction_outlined,
          title: l10n.homeEmergencyCta,
          subtitle: l10n.stubSectionSubtitle,
        ),
      ),
    );
  }
}
