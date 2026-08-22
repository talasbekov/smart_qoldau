import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import 'core/locale_controller.dart';
import 'l10n/app_localizations.dart';
import 'router.dart';

/// Корневой виджет клиентского приложения SmartQoldau.
///
/// Подключает дизайн-систему пакета `shared` ([sqTheme]), локализацию
/// ru/kz ([LocaleController]) и навигацию ([routerProvider], задача 7 эпика
/// E6) — весь переход между экранами (заставка → приветствие/онбординг →
/// главная с нижней навигацией) отныне решает редирект-гард `router.dart`,
/// а не этот виджет.
class SqClientApp extends ConsumerWidget {
  const SqClientApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeControllerProvider);
    final router = ref.watch(routerProvider);

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
