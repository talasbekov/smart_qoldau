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

/// Сколько раз подряд (без промежуточного успешного `connected`) стоит
/// пытаться обновить токен и переподключиться, прежде чем признать сессию
/// недействительной (см. [connectSqEvents], Round 1 ревью задачи 8, п.4).
/// Небольшое число — это подстраховка от бесконечного цикла, а не
/// собственно механизм рефреша (тот и так single-flight в
/// `AuthInterceptor`).
const int _authRetryBudget = 2;

/// Поднимает [SqEvents] поверх [socket] и держит его соединение в шаге с
/// access-токеном из [tokenStore]; при разрыве, похожем на отказ
/// аутентификации, проактивно обновляет токен через [refreshTokens] и
/// переподключается им же.
///
/// **Как шина узнаёт о смене токена** (см. брифинг задачи 8 — это
/// сознательно неочевидное место): единственный канал —
/// [TokenStore.accessTokenChanges]. В неё попадает КАЖДЫЙ `write()`/
/// `clear()` вне зависимости от того, кто его вызвал — явный вход и
/// конверсия гостя (`AuthRepository`), молчаливый рефреш access-токена
/// (`AuthInterceptor._doRefresh`, где `writeTokens` — это тот же самый
/// `tokenStore.write`, переданный в `SqApi` из [sqApiProvider]), явный
/// логаут (`AuthRepository.logout`), принудительный логаут при неудачном
/// рефреше ([sqApiProvider]`.onLogout`) — и, теперь, эта же функция при
/// исчерпании бюджета проактивных рефрешей ниже. Все они в итоге вызывают
/// методы ОДНОГО И ТОГО ЖЕ инстанса [TokenStore], который живёт в
/// [tokenStoreProvider]. `TokenStore.write`/`clear` сами сериализованы
/// (см. `TokenStore._enqueue`) — их уведомления в [TokenStore
/// .accessTokenChanges] приходят строго в порядке ВЫЗОВА, а не завершения
/// внутренних `await`, что важно именно здесь: иначе поздно завершившийся
/// `write()` от уже отменённого рефреша мог бы прийти ПОСЛЕ `clear()` от
/// логаута и заново поднять соединение для уже закрытой сессии.
///
/// Один нюанс требует отдельной обработки: сессия, ВОССТАНОВЛЕННАЯ при
/// холодном старте приложения (`AuthController.restore()`), идёт через
/// `TokenStore.read()`, а не через `write()` — `accessTokenChanges` её не
/// увидит. Поэтому здесь же, сразу после подписки, состояние досеивается
/// явным `tokenStore.read()` — но только для случая «сессия есть»:
/// свежесозданный [socket] и так ещё не подключён, вызывать `disconnect()`
/// ради отсутствующей сессии незачем.
///
/// **Гонка перекрывающихся смен токена** (Round 1 ревью, п.3): если
/// `accessTokenChanges` выдаёт два значения быстрее, чем `socket.connect`/
/// `disconnect` успевают выполниться, наивная реализация могла бы запустить
/// оба вызова ОДНОВРЕМЕННО — и тогда «проигравший» (тот, что стартовал
/// раньше, но завершился позже) переписывает состояние поверх «победителя»,
/// оставляя транспорт в устаревшем виде (например, подключённым протухшим
/// токеном ПОСЛЕ логаута). Правильный порядок гарантирует не очередь
/// заявок (каждая совершается сама по себе — тут не о персистентности, важно
/// только КОНЕЧНОЕ состояние), а drain-цикл с поколением (`_generation`):
/// `applyToken` только запоминает последний желаемый токен и запускает (или
/// не трогает, если уже запущен) единственный воркер, который после каждой
/// попытки проверяет, не появился ли токен новее, и если появился — тут же
/// применяет его тоже, вместо того чтобы застрять на устаревшем значении.
/// Флаг `applying` — тот же принцип «async-обработчик с флагом занятости
/// только в try/finally», что и в задаче 6 (иначе сбой транспорта посреди
/// цикла навсегда запер бы `applying = true`, и шина перестала бы реагировать
/// на дальнейшие смены токена).
///
/// **Разрыв, похожий на отказ аутентификации** (Round 1 ревью, п.4, чинено
/// повторно в Round 2 — см. ниже): `enableReconnection()` у
/// `socket_io_client` продолжает попытки СТАРЫМ токеном, зафиксированным в
/// handshake на момент `connect()` — если разрыв вызван именно протухшим
/// токеном (а не сетевым блипом), эти попытки обречены повторять один и тот
/// же немедленный отказ бесконечно, и `AuthInterceptor` тут не помощник —
/// он реагирует только на 401 у HTTP, а не на разрыв WS. Поэтому здесь
/// отдельный слушатель `connectionState`: на каждый `disconnected` (пока в
/// [tokenStore] ещё есть сессия) пробуем обновить токен через [refresh] и
/// ждём, пока `accessTokenChanges` сам поднимет переподключение — отдельно
/// вызывать `socket.connect` тут не нужно. Сбой именно с кодом
/// [ApiErrorCode.network] НЕ считается решающим (сеть может быть временно
/// недоступна — это не повод разлогинивать) и бюджет не трогает; любой
/// другой сбой (в первую очередь `401` на сам `/auth/refresh` —
/// refresh-токен тоже мёртв) сразу считается финальным. Бюджет
/// [_authRetryBudget] ограничивает число ПОДРЯД идущих попыток без
/// успешного `connected` между ними — исчерпание вызывает [onSessionInvalid]
/// (тот же путь, что и принудительный логаут в [sqApiProvider]).
///
/// **Round 2 ревью, п.1 (Critical) — ложный сигнал от нашего же
/// переподключения.** `SqSocket.connect()` начинается с `await
/// disconnect()`: КАЖДОЕ переподключение (в т.ч. штатный молчаливый рефреш)
/// само рвёт живой сокет как побочный эффект своей преамбулы. Раньше
/// `SocketIoSqSocket` публиковал `disconnected` для ЛЮБОГО разрыва, включая
/// этот намеренный — тогда штатный рефреш выглядел отсюда как «разрыв,
/// похожий на отказ аутентификации», запускал ВТОРОЙ, уже нелегальный
/// рефреш уже потраченным (бэкенд ротирует refresh-токены одноразово)
/// refresh-токеном, получал честный `401` и по ошибке разлогинивал
/// абсолютно исправную сессию. Починено на уровне транспорта:
/// `SocketIoSqSocket` теперь публикует `disconnected` только когда
/// `socket_io_client` сообщает причину разрыва, отличную от `'io client
/// disconnect'` (см. `sq_socket.dart`) — то есть только для разрывов,
/// пришедших ИЗВНЕ (сервер/сеть), а не порождённых нашей же преамбулой
/// `connect()`/явным `disconnect()`.
///
/// **Round 2 ревью, п.2 (Critical) — обход single-flight рефреша.** Эта
/// функция раньше звала `SqApi.refresh` напрямую, минуя single-flight
/// `AuthInterceptor`. Рефреш, вызванный HTTP-401, и рефреш, вызванный
/// разрывом WS, гонялись за один ОДНОРАЗОВЫЙ refresh-токен без всякой
/// координации — проигравший получал `401` и снова приводил к ложному
/// разлогину. Починено заведением единственного на клиент владельца
/// обновления токенов — `TokenRefresher` (`packages/shared`), которым
/// пользуется и `AuthInterceptor`, и эта функция через ОДИН И ТОТ ЖЕ
/// инстанс (`SqApi.tokenRefresher`, см. [sqEventsProvider]). [refresh] —
/// это `TokenRefresher.refresh`: без аргументов (сам читает актуальный
/// refresh-токен) и уже сам пишет результат в [TokenStore] — эта функция
/// больше не пишет токены повторно.
///
/// Вынесена отдельной верхнеуровневой функцией (не прямо в тело
/// `Provider`-фабрики) ради юнит-теста на фейковых [SqSocket]/[TokenStore] —
/// `test/core/sq_events_connection_test.dart` проверяет ровно эту логику
/// без Riverpod и без реальной сети.
({SqEvents events, Future<void> Function() dispose}) connectSqEvents(
  TokenStore tokenStore,
  SqSocket socket, {
  required Future<Tokens> Function() refresh,
  required void Function() onSessionInvalid,
}) {
  final events = SqEvents(socket);

  // --- применение токена: drain-цикл с поколением, см. комментарий выше ---
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
          // Best-effort — так же, как `EventsService.safeEmit` на бэкенде:
          // сбой ОДНОЙ попытки применения токена не должен прервать реакцию
          // на последующие смены.
        }
        if (myGeneration == generation) break;
        // Пока мы работали, пришёл более новый токен — применяем его тоже,
        // не дожидаясь отдельного вызова applyToken.
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

  // --- разрыв, похожий на отказ аутентификации, см. комментарий выше ---
  var authRetryBudget = _authRetryBudget;
  final connectionSub = socket.connectionState.listen((state) {
    if (state == SqConnectionState.connected) {
      authRetryBudget = _authRetryBudget;
      return;
    }
    if (state != SqConnectionState.disconnected) return;
    unawaited(() async {
      final tokens = await tokenStore.read();
      if (tokens == null) return; // уже разлогинены — чинить нечего

      if (authRetryBudget <= 0) {
        await tokenStore.clear();
        onSessionInvalid();
        return;
      }
      authRetryBudget--;

      try {
        // TokenRefresher.refresh() сам пишет результат в TokenStore —
        // переподключение запускается САМО через accessTokenChanges, здесь
        // писать токены повторно не нужно (и нельзя: второй write() того
        // же значения — лишняя, хоть и безобидная, реакция шины).
        await refresh();
      } on ApiException catch (e) {
        if (e.code == ApiErrorCode.network) {
          return; // сеть сейчас недоступна — не наш случай, ничего не решаем
        }
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

/// Шина реалтайм-событий (`request.updated`, `chat.message`, ... — см.
/// `packages/shared/lib/events`). Экраны читают `ref.watch(sqEventsProvider)
/// .stream`/`.forConsultation(id)`; соединение поднимается/рвётся
/// автоматически вместе с сессией (см. [connectSqEvents]).
///
/// `refresh: api.tokenRefresher.refresh` — намеренно НЕ `api.refresh`
/// (тот принимает конкретный refresh-токен и не координируется ни с чем):
/// `api.tokenRefresher` — ОДИН И ТОТ ЖЕ инстанс `TokenRefresher`, которым
/// внутри пользуется `AuthInterceptor` этого же `SqApi` — так HTTP-401 и
/// разрыв WS делят один single-flight, а не гоняются за один одноразовый
/// refresh-токен независимо (Round 2 ревью задачи 8, п.2).
final sqEventsProvider = Provider<SqEvents>((ref) {
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
});
