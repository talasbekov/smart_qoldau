/// Seam-провайдер для подключённой шины [SqEvents].
///
/// Задача 2 (E7): `ChatController` переехал в `shared` и читает
/// `ref.watch(sqEventsProvider)`, но реальное подключение шины
/// (`connectSqEvents` — реконнект, проактивный рефреш токена по cooldown,
/// разрешение гонки перекрывающихся смен токена, см. подробные комментарии
/// в `app_client/lib/core/providers.dart`) остаётся конфигурацией
/// конкретного приложения: `wsBaseUrl`, `TokenStore`, обработчик
/// инвалидации сессии — всё это принадлежит `app_client` (и будущему
/// `app_expert` со своими значениями). Сама race-condition-чувствительная
/// логика `connectSqEvents` НЕ переносится и не трогается — эта заглушка
/// лишь даёт `ChatController` точку внедрения, тот же паттерн, что уже
/// используется у `push_bootstrap.dart`/`sqApiProvider`.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'sq_events.dart';

/// По умолчанию бросает: если приложение забыло переопределить его при
/// старте, лучше явная ошибка сразу, чем шина без реального транспорта.
final sqEventsProvider = Provider<SqEvents>(
  (ref) => throw UnimplementedError(
    'sqEventsProvider должен быть переопределён приложением в main() '
    '(см. app_client/lib/main.dart)',
  ),
);
