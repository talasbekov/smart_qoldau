/// Узкий порт над Firebase Messaging.
///
/// Существует ради тестируемости и ради выключенной сборки: `firebase_*`
/// работает через платформенные каналы, которых в headless-тесте нет, а
/// при `PUSH_ENABLED=false` приложение не должно трогать Firebase вовсе.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Пуш в том виде, в каком он нужен приложению: заголовок, текст и
/// `data`-полезная нагрузка бэкенда (`notification-templates.ts`).
class PushMessage {
  const PushMessage({
    required this.title,
    required this.body,
    required this.data,
  });

  final String title;
  final String body;
  final Map<String, dynamic> data;
}

abstract class PushMessagingPort {
  /// Инициализация Firebase и подписки. Вызывается только при включённых
  /// пушах.
  Future<void> initialize();

  /// Запрашивает разрешение на уведомления (iOS и Android 13+).
  /// `false` — пользователь отказал: это нормальный исход, приложение
  /// продолжает работать без пушей.
  Future<bool> requestPermission();

  /// Текущий push-токен устройства. `null`, если его нет.
  Future<String?> token();

  /// Токен сменился (перевыпуск FCM) — устройство надо перерегистрировать.
  Stream<String> get tokenRefresh;

  /// Пуш пришёл, пока приложение открыто.
  Stream<PushMessage> get onForegroundMessage;

  /// Пользователь нажал на пуш и открыл приложение.
  Stream<PushMessage> get onMessageOpened;

  /// Пуш, из которого приложение запустилось «с холода». Возвращает его
  /// один раз — повторный вызов даёт `null`.
  Future<PushMessage?> takeInitialMessage();
}

/// Порт по умолчанию переопределяется в `main()` реальной реализацией
/// только при включённых пушах.
final pushMessagingPortProvider = Provider<PushMessagingPort>(
  (ref) => throw UnimplementedError(
    'pushMessagingPortProvider должен быть переопределён реализацией '
    'FirebasePushMessagingPort в main() при PUSH_ENABLED=true',
  ),
);
