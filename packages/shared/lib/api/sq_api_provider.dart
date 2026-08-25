/// Seam-провайдер для сконфигурированного [SqApi].
///
/// Задача 2 (E7): `ChatRepository`/`MediaRepository` (и с ними —
/// `ChatController`/`CallController`) переехали в `shared` и нуждаются в
/// `SqApi`, но его реальное построение (`baseUrl`, хранилище токенов,
/// `onLogout`) — это конфигурация конкретного приложения
/// (`app_client/lib/core/providers.dart`), а не то, что можно захардкодить
/// в пакете, которым позже будет пользоваться и `app_expert` со своим
/// собственным хранилищем токенов. Тот же паттерн, что уже используется в
/// `push/push_messaging_port.dart` (`pushMessagingPortProvider`) и в
/// `push/push_bootstrap.dart` (`pushNavigatorProvider`,
/// `localNotificationPresenterProvider`): безопасная заглушка здесь,
/// реальное поведение — через `overrideWith` в `main()` приложения.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'sq_api.dart';

/// По умолчанию бросает: если приложение забыло переопределить его при
/// старте, лучше явная ошибка сразу, чем тихий запрос без токенов.
final sqApiProvider = Provider<SqApi>(
  (ref) => throw UnimplementedError(
    'sqApiProvider должен быть переопределён приложением в main() '
    '(см. app_client/lib/main.dart)',
  ),
);
