import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import 'core/locale_controller.dart';
import 'l10n/app_localizations.dart';

/// Корневой виджет клиентского приложения SmartQoldau.
///
/// Подключает дизайн-систему пакета `shared` ([sqTheme]) и локализацию
/// ru/kz ([LocaleController]) — интерфейс на русском и казахском доступен
/// с первого экрана, переключение языка живёт в настройках (задача 3
/// эпика E6).
class SqClientApp extends ConsumerWidget {
  const SqClientApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final locale = ref.watch(localeControllerProvider);

    return MaterialApp(
      title: 'SmartQoldau',
      onGenerateTitle: (context) => AppLocalizations.of(context)!.appTitle,
      theme: sqTheme(),
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
    );
  }
}
