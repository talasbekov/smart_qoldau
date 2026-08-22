/// Провайдеры инфраструктуры: адрес бэкенда, секьюрное хранилище и `SqApi`.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../features/auth/state/auth_controller.dart';
import 'token_store.dart';

/// Адрес бэкенда. Задаётся при сборке через `--dart-define=API_BASE_URL`
/// (см. `app_client/README.md`); значение по умолчанию — адрес хоста из
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

final tokenStoreProvider = Provider<TokenStore>(
  (ref) => TokenStore(ref.watch(secureStoreProvider)),
);

/// Единая точка входа в бэкенд SmartQoldau.
///
/// `onLogout` читает [authControllerProvider] через `ref.read` в момент
/// вызова, а не `ref.watch` при построении — иначе получился бы цикл
/// провайдеров: `SqApi` нужен `AuthController` (чтобы ходить в сеть), а
/// `onLogout` нужен `SqApi` (чтобы разлогинить при неудачном рефреше).
/// `ref.read` внутри колбэка разрывает цикл: колбэк не строит
/// `authControllerProvider` прямо сейчас, а обращается к нему только когда
/// его действительно вызовет `AuthInterceptor`.
final sqApiProvider = Provider<SqApi>((ref) {
  final tokenStore = ref.watch(tokenStoreProvider);
  return SqApi(
    baseUrl: apiBaseUrl,
    readTokens: tokenStore.read,
    writeTokens: tokenStore.write,
    onLogout: () => ref.read(authControllerProvider.notifier).logout(),
  );
});
