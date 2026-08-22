import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/locale_controller.dart';
import 'core/push/fcm_push_token_source.dart';
import 'core/push/firebase_push_messaging_port.dart';
import 'core/push/push_bootstrap.dart';
import 'core/push/push_config.dart';
import 'core/push/push_messaging_port.dart';
import 'core/push_token_source.dart';
import 'router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();

  // Пуши включаются флагом сборки (`--dart-define=PUSH_ENABLED=true`) и
  // требуют настоящего проекта Firebase. При выключенном флаге порт
  // Firebase не создаётся вовсе — ни одного обращения к нему.
  const pushConfig = PushConfig.fromEnvironment();
  final port = pushConfig.enabled ? FirebasePushMessagingPort() : null;

  final container = ProviderContainer(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      pushConfigProvider.overrideWithValue(pushConfig),
      if (port != null) ...[
        pushMessagingPortProvider.overrideWithValue(port),
        pushTokenSourceProvider.overrideWith(
          (ref) => ref.watch(fcmAwarePushTokenSourceProvider),
        ),
        localNotificationPresenterProvider.overrideWithValue(port.showLocal),
      ],
      // Навигация по нажатому пушу идёт тем же роутером, что и всё
      // остальное: отдельный стек разошёлся бы с редирект-гардом сессии.
      pushNavigatorProvider.overrideWith(
        (ref) => (route) => ref.read(routerProvider).go(route),
      ),
    ],
  );

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const SqClientApp(),
    ),
  );

  // Инициализация пуш-канала — после запуска приложения: она не должна
  // задерживать первый кадр.
  await container.read(pushBootstrapProvider).init();
}
