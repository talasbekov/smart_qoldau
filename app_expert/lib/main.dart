import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/incoming_offer_alert_port.dart';
import 'core/locale_controller.dart';
import 'core/providers.dart';
import 'core/push/fcm_push_token_source.dart';
import 'core/push_token_source.dart';
import 'features/notifications/state/notifications_controller.dart';
import 'features/notifications/ui/notification_tile.dart';
import 'features/offers/state/incoming_offer_controller.dart';
import 'router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final prefs = await SharedPreferences.getInstance();

  // Пуши включаются флагом сборки (`--dart-define=PUSH_ENABLED=true`) и
  // требуют настоящего проекта Firebase — тот же приём, что
  // `app_client/lib/main.dart`. При выключенном флаге порт Firebase не
  // создаётся вовсе — ни одного обращения к нему.
  const pushConfig = PushConfig.fromEnvironment();
  final port = pushConfig.enabled ? FirebasePushMessagingPort() : null;

  final container = ProviderContainer(
    overrides: [
      sharedPreferencesProvider.overrideWithValue(prefs),
      pushConfigProvider.overrideWithValue(pushConfig),
      // `sqApiProvider`/`sqEventsProvider` — placeholder-провайдеры
      // `shared`; реальное построение — `buildSqApi`/`buildSqEvents` в
      // `core/providers.dart` (задача 2 перенесла тела сюда, но `main()`
      // до задачи 11 их не подключал — офферам понадобилась шина).
      sqApiProvider.overrideWith(buildSqApi),
      sqEventsProvider.overrideWith(buildSqEvents),
      // Регистрация push-токена — задача 16 заменяет прямой вызов
      // `api.registerDevice` (задача 11) на `DeviceRegistrar`: тот же
      // паттерн, что `app_client`, с локалью и перерегистрацией при смене
      // языка (`core/locale_controller.dart`).
      deviceTokenRegistrarProvider.overrideWith(
        (ref) => (token) => ref.read(deviceRegistrarProvider).registerToken(token),
      ),
      // Маршрут пуша — `PushBootstrap` не знает про `RoutePaths`; разбор
      // тот же самый, что у тайла центра уведомлений.
      pushRouteResolverProvider.overrideWithValue(notificationRoute),
      // Пуш в форграунде обновляет центр уведомлений.
      notificationsRefresherProvider.overrideWith(
        (ref) => ref.read(notificationsControllerProvider.notifier).refresh,
      ),
      if (port != null) ...[
        pushMessagingPortProvider.overrideWithValue(port),
        pushTokenSourceProvider.overrideWith(
          (ref) => ref.watch(fcmAwarePushTokenSourceProvider),
        ),
        localNotificationPresenterProvider.overrideWithValue(port.showLocal),
      ],
      // Навигация по нажатому пушу — тем же роутером, что и всё
      // остальное: отдельный стек разошёлся бы с редирект-гардом сессии.
      pushNavigatorProvider.overrideWith(
        (ref) => (route) => ref.read(routerProvider).go(route),
      ),
      // Полноэкранный алерт входящего оффера (задача 11) — рисуется
      // `showDialog` через корневой навигатор, а не отдельным маршрутом
      // (см. `IncomingOfferAlertPort`).
      incomingOfferAlertPortProvider.overrideWith(
        (ref) => NavigatorIncomingOfferAlertPort(ref.watch(appNavigatorKeyProvider)),
      ),
    ],
  );

  // Держит `IncomingOfferController` живым НЕЗАВИСИМО от того, какой экран
  // сейчас открыт: `Notifier` (не autoDispose) утилизировался бы сразу
  // после чтения без постоянного слушателя, а оффер обязан ловиться на
  // ЛЮБОМ экране, не только на том, что случайно его читает.
  container.listen(incomingOfferControllerProvider, (previous, next) {});

  // Регистрация устройства для пушей, как только у эксперта появляется
  // сессия (задача 16).
  container.read(deviceRegistrationProvider);

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const SqExpertApp(),
    ),
  );

  // Инициализация пуш-канала — после запуска приложения: она не должна
  // задерживать первый кадр.
  await container.read(pushBootstrapProvider).init();
}
