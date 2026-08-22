/// Провайдеры инфраструктуры: адрес бэкенда, секьюрное хранилище, `SqApi` и
/// шина реалтайм-событий.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import 'token_store.dart';

/// Адрес бэкенда. Задаётся при сборке через `--dart-define=API_BASE_URL`
/// (см. `app_client/README.md`); значение по умолчанию — адрес хоста из
/// Android-эмулятора.
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000/v1',
);

/// Адрес бэкенда для реалтайм-шины (`SocketIoSqSocket`) — БЕЗ префикса
/// `/v1` и без пути неймспейса: `/ws` дописывает сам `SocketIoSqSocket`.
/// Отдельный dart-define (не переиспользует [apiBaseUrl]) — так же, как это
/// зафиксировано в плане эпика E6 (`--dart-define=WS_BASE_URL`).
const String wsBaseUrl = String.fromEnvironment(
  'WS_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000',
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
/// от `features`, разворачивая обычное направление зависимостей монорепо
/// (`features` вправе знать про `core`, но не наоборот) и создавая цикл
/// импортов `core → features → data → core`. Вместо этого `core` только
/// объявляет универсальный сигнал «сессия только что была аннулирована»,
/// а `AuthController` сам подписывается на него через `ref.listen` в своём
/// `build()` и реагирует переходом в `AuthAnonymous` — зависимость идёт
/// только в одну сторону: `features` → `core`.
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

/// Поднимает [SqEvents] поверх [socket] и держит его соединение в шаге с
/// access-токеном из [tokenStore].
///
/// **Как шина узнаёт о смене токена** (см. брифинг задачи 8 — это
/// сознательно неочевидное место): единственный канал —
/// [TokenStore.accessTokenChanges]. В неё попадает КАЖДЫЙ `write()`/
/// `clear()` вне зависимости от того, кто его вызвал — явный вход и
/// конверсия гостя (`AuthRepository`), молчаливый рефреш access-токена
/// (`AuthInterceptor._doRefresh`, где `writeTokens` — это тот же самый
/// `tokenStore.write`, переданный в `SqApi` из [sqApiProvider]), явный
/// логаут (`AuthRepository.logout`) и принудительный логаут при неудачном
/// рефреше ([sqApiProvider]`.onLogout`) — все они в итоге вызывают методы
/// ОДНОГО И ТОГО ЖЕ инстанса [TokenStore], который живёт в
/// [tokenStoreProvider]. Отдельно разбирать «это новый логин» от «это
/// молчаливый рефреш» не нужно — реакция одна и та же: непустой токен просто
/// подаётся в `socket.connect(token)` (он сам рвёт предыдущее соединение,
/// если оно было — см. `SocketIoSqSocket.connect`), `null` — рвёт его через
/// `socket.disconnect()`.
///
/// Одно исключение: сессия, ВОССТАНОВЛЕННАЯ при холодном старте приложения
/// (`AuthController.restore()`), идёт через `TokenStore.read()`, а не через
/// `write()` — `accessTokenChanges` её не увидит. Поэтому здесь же, сразу
/// после подписки, состояние досеивается явным `tokenStore.read()` — но
/// только для случая «сессия есть»: свежесозданный [socket] и так ещё не
/// подключён, вызывать `disconnect()` ради отсутствующей сессии незачем.
///
/// Вынесена отдельной верхнеуровневой функцией (не прямо в тело
/// `Provider`-фабрики) ради юнит-теста на фейковом [SqSocket] —
/// `test/core/sq_events_connection_test.dart` проверяет ровно эту логику
/// без Riverpod и без реальной сети.
({SqEvents events, Future<void> Function() dispose}) connectSqEvents(
  TokenStore tokenStore,
  SqSocket socket,
) {
  final events = SqEvents(socket);

  Future<void> applyToken(String? token) =>
      token == null ? socket.disconnect() : socket.connect(token);

  final subscription = tokenStore.accessTokenChanges.listen(applyToken);
  unawaited(
    tokenStore.read().then((tokens) {
      final restoredToken = tokens?.accessToken;
      if (restoredToken != null) return applyToken(restoredToken);
    }),
  );

  return (
    events: events,
    dispose: () async {
      await subscription.cancel();
      await socket.disconnect();
    },
  );
}

/// Шина реалтайм-событий (`request.updated`, `chat.message`, ... — см.
/// `packages/shared/lib/events`). Экраны читают `ref.watch(sqEventsProvider)
/// .stream`/`.forConsultation(id)`; соединение поднимается/рвётся
/// автоматически вместе с сессией (см. [connectSqEvents]).
final sqEventsProvider = Provider<SqEvents>((ref) {
  final tokenStore = ref.watch(tokenStoreProvider);
  final socket = SocketIoSqSocket(wsBase: wsBaseUrl);
  final connection = connectSqEvents(tokenStore, socket);
  ref.onDispose(() => unawaited(connection.dispose()));
  return connection.events;
});
