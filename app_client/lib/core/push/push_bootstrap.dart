/// Инициализация пуш-канала и обработка входящих сообщений.
library;

import 'dart:async';
import 'dart:developer' as developer;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../features/notifications/state/notifications_controller.dart';
import '../../features/notifications/ui/notification_tile.dart';
import 'push_config.dart';
import 'push_messaging_port.dart';

/// Куда уводит нажатый пуш. Переопределяется в `main()` реальной
/// навигацией роутера; в тестах — записью маршрута.
final pushNavigatorProvider = Provider<void Function(String route)>(
  (ref) => (route) => developer.log(
    'некому обработать переход по пушу: $route',
    name: 'PushBootstrap',
  ),
);

/// Показ локального уведомления для пуша, пришедшего в форграунде.
final localNotificationPresenterProvider =
    Provider<void Function(PushMessage message)>(
      (ref) => (message) => developer.log(
        'локальное уведомление не показано: канал не настроен',
        name: 'PushBootstrap',
      ),
    );

class PushBootstrap {
  PushBootstrap(this._ref);

  final Ref _ref;

  final List<StreamSubscription<void>> _subscriptions = [];

  /// Поднимает пуш-канал. При выключенном флаге не делает ничего — ни
  /// одного обращения к Firebase.
  Future<void> init() async {
    if (!_ref.read(pushConfigProvider).enabled) return;

    final port = _ref.read(pushMessagingPortProvider);
    await port.initialize();

    // Отказ в разрешении — нормальный исход (урок 8 плана эпика): пушей не
    // будет, но приложение работает. Токен в этом случае не запрашиваем.
    final granted = await port.requestPermission();
    if (!granted) return;

    final token = await port.token();
    if (token != null && token.isNotEmpty) {
      await _register(token);
    }

    _subscriptions.add(port.tokenRefresh.listen(_register));
    _subscriptions.add(port.onMessageOpened.listen(_navigate));
    _subscriptions.add(
      port.onForegroundMessage.listen((message) {
        // Пуш пришёл, пока человек в приложении: уводить его с открытого
        // экрана (чата, звонка) нельзя — это разница между «пришло» и
        // «пользователь нажал». Показываем локальное уведомление и
        // обновляем центр уведомлений.
        _ref.read(localNotificationPresenterProvider)(message);
        unawaited(_ref.read(notificationsControllerProvider.notifier).refresh());
      }),
    );

    // Холодный старт из пуша: сообщение забирается один раз.
    final initial = await port.takeInitialMessage();
    if (initial != null) _navigate(initial);
  }

  Future<void> _register(String token) async {
    try {
      await _ref.read(deviceRegistrarProvider).registerToken(token);
    } catch (error) {
      developer.log(
        'регистрация push-токена не удалась: ${error.runtimeType}',
        name: 'PushBootstrap',
      );
    }
  }

  void _navigate(PushMessage message) {
    final route = _routeFor(message);
    if (route == null) return;
    _ref.read(pushNavigatorProvider)(route);
  }

  /// Маршрут пуша считается ТЕМ ЖЕ разбором, что и тайл центра
  /// уведомлений: два места с разными правилами разошлись бы на первом же
  /// новом типе уведомления.
  String? _routeFor(PushMessage message) {
    final type = message.data['type'];
    if (type is! String) return null;
    return notificationRoute(
      AppNotification(
        id: '',
        type: type,
        title: message.title,
        body: message.body,
        data: message.data,
        readAt: null,
        createdAt: DateTime.fromMillisecondsSinceEpoch(0),
      ),
    );
  }

  Future<void> dispose() async {
    for (final subscription in _subscriptions) {
      await subscription.cancel();
    }
    _subscriptions.clear();
  }
}

final pushBootstrapProvider = Provider<PushBootstrap>((ref) {
  final bootstrap = PushBootstrap(ref);
  ref.onDispose(bootstrap.dispose);
  return bootstrap;
});
