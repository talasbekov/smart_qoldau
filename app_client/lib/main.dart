import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/deep_links.dart';
import 'core/locale_controller.dart';
import 'core/providers.dart';
import 'core/push/fcm_push_token_source.dart';
import 'core/push_token_source.dart';
import 'features/notifications/state/notifications_controller.dart';
import 'features/notifications/ui/notification_tile.dart';
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
      // `sqApiProvider`/`sqEventsProvider` — placeholder-провайдеры `shared`
      // (задача 2, E7): `ChatRepository`/`MediaRepository`/`ChatController`
      // теперь живут там и не могут захардкодить конфигурацию конкретного
      // приложения (адрес бэкенда, хранилище токенов). Тела те же самые,
      // что были раньше объявлены прямо как провайдеры здесь — см.
      // `buildSqApi`/`buildSqEvents` в `core/providers.dart`.
      sqApiProvider.overrideWith(buildSqApi),
      sqEventsProvider.overrideWith(buildSqEvents),
      // Регистрация push-токена — `PushBootstrap` (`shared`) знает только
      // «вызвать API регистрации», а платформу/локаль знает `DeviceRegistrar`
      // (`features/notifications`), как и раньше.
      deviceTokenRegistrarProvider.overrideWith(
        (ref) => ref.read(deviceRegistrarProvider).registerToken,
      ),
      // Маршрут пуша — `PushBootstrap` не знает про `RoutePaths`; разбор тот
      // же самый, что у тайла центра уведомлений.
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
      // Навигация по нажатому пушу и по отложенной ссылке идёт тем же
      // роутером, что и всё остальное: отдельный стек разошёлся бы с
      // редирект-гардом сессии.
      pushNavigatorProvider.overrideWith(
        (ref) =>
            (route) => ref.read(routerProvider).go(route),
      ),
      deepLinkNavigatorProvider.overrideWith(
        (ref) =>
            (route) => ref.read(routerProvider).go(route),
      ),
    ],
  );

  // Обработчик отложенных ссылок должен существовать до первого кадра:
  // ссылка холодного старта приходит роутеру сразу, ещё до восстановления
  // сессии.
  container.read(deepLinkHandlerProvider);

  runApp(
    UncontrolledProviderScope(container: container, child: const SqClientApp()),
  );

  // Инициализация пуш-канала — после запуска приложения: она не должна
  // задерживать первый кадр.
  await container.read(pushBootstrapProvider).init();
}
