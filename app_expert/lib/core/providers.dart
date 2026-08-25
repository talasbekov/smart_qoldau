/// Провайдеры инфраструктуры: адрес бэкенда, секьюрное хранилище, `SqApi` и
/// шина реалтайм-событий.
library;

import 'dart:async';

import 'package:flutter/widgets.dart';
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

/// Адрес бэкенда для реалтайм-шины (`SocketIoSqSocket`) — БЕЗ префикса
/// `/v1` (тот же приём, что `app_client/lib/core/providers.dart`).
const String wsBaseUrl = String.fromEnvironment(
  'WS_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000',
);

/// Корневой навигатор приложения — точка входа для UI, которому нужен
/// `BuildContext` вне дерева текущего экрана (задача 11: полноэкранный
/// алерт входящего оффера может прийти на любом маршруте, поэтому рисуется
/// через `showDialog` поверх `Navigator`, а не как отдельный маршрут).
/// Передаётся в `GoRouter(navigatorKey: ...)` (`router.dart`), чтобы у
/// `go_router` и у этого провайдера был ОДИН И ТОТ ЖЕ навигатор.
final appNavigatorKeyProvider = Provider<GlobalKey<NavigatorState>>(
  (ref) => GlobalKey<NavigatorState>(debugLabel: 'sq-expert-root'),
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

/// Тело реального `sqApiProvider` — `shared` объявляет его лишь как
/// placeholder-заглушку (`api/sq_api_provider.dart`, экспортирован через
/// `shared.dart`), которую переопределяет каждое приложение своей
/// конфигурацией (тот же приём, что в `app_client/lib/core/providers.dart`,
/// `buildSqApi`). Раньше здесь был собственный `final sqApiProvider = ...`
/// — это стало неоднозначным импортом, как только `shared` начала
/// экспортировать провайдер с тем же именем (перенос chat/call/push в
/// `shared`), поэтому построение вынесено в функцию и подключается через
/// `sqApiProvider.overrideWith(buildSqApi)` в `main()`.
///
/// `onLogout` не вызывает `AuthController` напрямую (см.
/// [sessionInvalidatedProvider]): чистит хранилище токенов, до которого
/// `core` и так имеет прямой доступ ([tokenStoreProvider]), и увеличивает
/// счётчик — реакцию на него берёт на себя `features/auth`.
SqApi buildSqApi(Ref ref) {
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
}

/// Throttle проактивного рефреша на разрыв WS, похожий на отказ
/// аутентификации — см. [connectSqEvents].
const Duration _authRefreshCooldown = Duration(seconds: 30);

/// Поднимает [SqEvents] поверх [socket] и держит его соединение в шаге с
/// access-токеном из [tokenStore]; при разрыве, похожем на отказ
/// аутентификации, проактивно обновляет токен через [refresh] и
/// переподключается им же.
///
/// Точная копия `app_client/lib/core/providers.dart` (`connectSqEvents`) —
/// логика реконнекта не зависит от конкретного приложения (`TokenStore`
/// обоих пакетов — идентичный контракт, см. `token_store.dart`), только от
/// его `TokenStore`/`SqApi`. Полное обоснование каждого решения (drain-цикл
/// с поколением против гонки перекрывающихся токенов, cooldown вместо
/// счётчика попыток, различение `401` на `/auth/refresh` от сетевых сбоев,
/// почему `SocketIoSqSocket` публикует `disconnected` только для внешних
/// разрывов) — там же, в докстринге оригинала; здесь не продублировано,
/// чтобы не разойтись при будущих правках одного места без другого.
/// Вынесена отдельной функцией ради юнит-теста на фейковых
/// [SqSocket]/[TokenStore] без Riverpod и без реальной сети.
({SqEvents events, Future<void> Function() dispose}) connectSqEvents(
  TokenStore tokenStore,
  SqSocket socket, {
  required Future<Tokens> Function() refresh,
  required void Function() onSessionInvalid,
  DateTime Function() now = DateTime.now,
}) {
  final events = SqEvents(socket);

  var generation = 0;
  String? latestToken;
  var applying = false;

  Future<void> drain() async {
    if (applying) return;
    applying = true;
    try {
      while (true) {
        final myGeneration = generation;
        final token = latestToken;
        try {
          if (token == null) {
            await socket.disconnect();
          } else {
            await socket.connect(token);
          }
        } catch (_) {
          // Best-effort — сбой ОДНОЙ попытки применения токена не должен
          // прервать реакцию на последующие смены.
        }
        if (myGeneration == generation) break;
      }
    } finally {
      applying = false;
    }
  }

  void applyToken(String? token) {
    latestToken = token;
    generation++;
    unawaited(drain());
  }

  final tokenSub = tokenStore.accessTokenChanges.listen(applyToken);

  DateTime? lastAuthRefreshAttempt;
  final connectionSub = socket.connectionState.listen((state) {
    if (state != SqConnectionState.disconnected) return;
    unawaited(() async {
      final tokens = await tokenStore.read();
      if (tokens == null) return;

      final attemptAt = now();
      final last = lastAuthRefreshAttempt;
      if (last != null && attemptAt.difference(last) < _authRefreshCooldown) {
        return;
      }
      lastAuthRefreshAttempt = attemptAt;

      try {
        await refresh();
      } on ApiException catch (e) {
        if (e.code != ApiErrorCode.unauthorized) return;
        await tokenStore.clear();
        onSessionInvalid();
      }
    }());
  });

  unawaited(
    tokenStore.read().then((tokens) {
      final restoredToken = tokens?.accessToken;
      if (restoredToken != null) applyToken(restoredToken);
    }),
  );

  return (
    events: events,
    dispose: () async {
      await tokenSub.cancel();
      await connectionSub.cancel();
      await socket.disconnect();
    },
  );
}

/// Тело реального [sqEventsProvider] — тот же приём, что [buildSqApi]:
/// `shared` объявляет только placeholder, конфигурацию (адрес, `SqApi`,
/// реакция на отказ аутентификации) даёт каждое приложение через
/// `sqEventsProvider.overrideWith(buildSqEvents)` в `main()`.
SqEvents buildSqEvents(Ref ref) {
  final tokenStore = ref.watch(tokenStoreProvider);
  final api = ref.watch(sqApiProvider);
  final socket = SocketIoSqSocket(wsBase: wsBaseUrl);
  final connection = connectSqEvents(
    tokenStore,
    socket,
    refresh: api.tokenRefresher.refresh,
    onSessionInvalid: () =>
        ref.read(sessionInvalidatedProvider.notifier).state++,
  );
  ref.onDispose(() => unawaited(connection.dispose()));
  return connection.events;
}
