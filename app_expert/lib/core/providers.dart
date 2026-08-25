/// Провайдеры инфраструктуры: адрес бэкенда, секьюрное хранилище, `SqApi`.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import 'token_store.dart';

/// Адрес бэкенда. Задаётся при сборке через `--dart-define=API_BASE_URL`
/// (см. `app_expert/README.md`); значение по умолчанию — адрес хоста из
/// Android-эмулятора.
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000/v1',
);

/// Секьюрное хранилище ключ-значение — платформенный плагин, провайдер
/// удобно переопределять в тестах фейком (см. [SecureStore]).
final secureStoreProvider = Provider<SecureStore>(
  (ref) => const FlutterSecureStore(),
);

final tokenStoreProvider = Provider<TokenStore>((ref) {
  final store = TokenStore(ref.watch(secureStoreProvider));
  ref.onDispose(store.dispose);
  return store;
});

/// Тикает (увеличивается на 1) при каждом принудительном разлогине со
/// стороны бэкенда — когда `AuthInterceptor` не смог обновить протухший
/// access-токен через `/auth/refresh`.
///
/// `core` намеренно не хранит здесь прямую ссылку на `AuthController`
/// (`features/auth/state/auth_controller.dart`) — иначе `core` зависел бы
/// от `features`, разворачивая обычное направление зависимостей монорепо.
/// Вместо этого `core` только объявляет универсальный сигнал «сессия только
/// что была аннулирована», а `AuthController` сам подписывается на него
/// через `ref.listen` в своём `build()` (тот же приём, что в `app_client`).
final sessionInvalidatedProvider = StateProvider<int>((ref) => 0);

/// Единая точка входа в бэкенд SmartQoldau.
///
/// `onLogout` не вызывает `AuthController` напрямую (см.
/// [sessionInvalidatedProvider]): чистит хранилище токенов, до которого
/// `core` и так имеет прямой доступ ([tokenStoreProvider]), и увеличивает
/// счётчик — реакцию на него берёт на себя `features/auth`.
final sqApiProvider = Provider<SqApi>((ref) {
  final tokenStore = ref.watch(tokenStoreProvider);
  return SqApi(
    baseUrl: apiBaseUrl,
    readTokens: tokenStore.read,
    writeTokens: tokenStore.write,
    onLogout: () async {
      await tokenStore.clear();
      ref.read(sessionInvalidatedProvider.notifier).state++;
    },
  );
});
