/// Корневой виджет приложения эксперта SmartQoldau.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import 'core/locale_controller.dart';
import 'l10n/app_localizations.dart';
import 'router.dart';

/// Аналог `SqClientApp` из `app_client` — локализация ru/kk (задача 17
/// эпика E7) и без гостевого режима (см.
/// `features/auth/state/auth_controller.dart`).
class SqExpertApp extends ConsumerWidget {
  const SqExpertApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final locale = ref.watch(localeControllerProvider);

    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context)!.appTitle,
      theme: sqTheme(),
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      routerConfig: router,
    );
  }
}
