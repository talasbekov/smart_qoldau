import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import 'app.dart';
import 'core/incoming_offer_alert_port.dart';
import 'core/providers.dart';
import 'features/offers/state/incoming_offer_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Пуши включаются флагом сборки (`--dart-define=PUSH_ENABLED=true`) и
  // требуют настоящего проекта Firebase — тот же приём, что
  // `app_client/lib/main.dart`. При выключенном флаге порт Firebase не
  // создаётся вовсе — ни одного обращения к нему.
  const pushConfig = PushConfig.fromEnvironment();
  final port = pushConfig.enabled ? FirebasePushMessagingPort() : null;

  final container = ProviderContainer(
    overrides: [
      pushConfigProvider.overrideWithValue(pushConfig),
      // `sqApiProvider`/`sqEventsProvider` — placeholder-провайдеры
      // `shared`; реальное построение — `buildSqApi`/`buildSqEvents` в
      // `core/providers.dart` (задача 2 перенесла тела сюда, но `main()`
      // до задачи 11 их не подключал — офферам понадобилась шина).
      sqApiProvider.overrideWith(buildSqApi),
      sqEventsProvider.overrideWith(buildSqEvents),
      // Регистрация push-токена — `PushBootstrap` (`shared`) знает только
      // «вызвать API регистрации», платформу берёт отсюда. У `app_expert`
      // нет `LocaleController` (см. `app.dart`) — локаль не передаётся,
      // бэкенд использует значение по умолчанию.
      deviceTokenRegistrarProvider.overrideWith(
        (ref) => (token) => ref.read(sqApiProvider).registerDevice(
              platform: defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
              token: token,
            ),
      ),
      if (port != null) ...[
        pushMessagingPortProvider.overrideWithValue(port),
        localNotificationPresenterProvider.overrideWithValue(port.showLocal),
      ],
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
