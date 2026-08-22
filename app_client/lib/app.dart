import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import 'core/locale_controller.dart';
import 'features/auth/state/auth_controller.dart';
import 'features/auth/ui/phone_screen.dart';
import 'features/auth/ui/splash_screen.dart';
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
      onGenerateTitle: (context) => AppLocalizations.of(context)!.appTitle,
      theme: sqTheme(),
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      home: SplashScreen(onRestored: _onRestored),
    );
  }

  /// Временная навигация после восстановления сессии — до задачи 7 эпика
  /// E6, которая подключит `go_router` и заменит её настоящими
  /// маршрутами. Экран для гостя/зарегистрированного пользователя
  /// появится только в этой будущей задаче, поэтому пока переход есть
  /// только для анонимного пользователя — на вход по номеру телефона.
  void _onRestored(BuildContext context, AuthState state) {
    if (state is AuthAnonymous) {
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => const PhoneScreen()));
    }
  }
}
