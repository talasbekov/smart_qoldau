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

/// Часы приложения — точка внедрения времени для тестов. В проде это
/// `DateTime.now`; экраны записи (E6b) считают по ним и горизонт, и
/// отсчёт «через 2 ч 15 мин».
final nowProvider = Provider<DateTime Function()>((ref) => DateTime.now);

/// Тело реального [sqApiProvider] — задача 2 (E7) перенесла сам провайдер в
/// `shared` как placeholder (`ChatRepository`/`MediaRepository` теперь
/// живут там и должны собираться самодостаточно), а построение настоящего
/// `SqApi` осталось конфигурацией приложения: `main()` переопределяет
/// `sqApiProvider` этой же самой функцией (`.overrideWith(buildSqApi)`),
/// один в один с тем, что было здесь раньше — никаких изменений в логике.
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

/// Минимальный интервал между проактивными попытками обновить токен из-за
/// разрыва WS, похожего на отказ аутентификации (см. [connectSqEvents]).
///
/// **Round 4 ревью, п.2 — заменяет собой бывший счётчик-бюджет попыток**
/// (`_authRetryBudget`, Round 1/3). Счётчик оказался не тем инструментом:
/// он либо срабатывал слишком рано на чисто сетевых сбоях (баг Round 3),
/// либо, будучи исправлен, просто не отвечал на реальный вопрос. Настоящий
/// `401` теперь инвалидирует сессию НЕМЕДЛЕННО, с первой же попытки (см.
/// комментарий в [connectSqEvents] — почему повтор структурно не имеет
/// смысла), так что считать там уже нечего. А для «сеть то есть, то нет»
/// нужен не счётчик «сколько раз подряд мы уже проиграли», а простой
/// **cooldown** — «не долбим `/auth/refresh` чаще, чем раз в интервал»,
/// без какой-либо инвалидации по исчерпанию: сетевой сбой никогда не
/// повод разлогинивать (см. [ApiErrorCode.network] в [connectSqEvents]),
/// он просто не должен порождать НЕОГРАНИЧЕННО частые попытки.
///
/// **Откуда именно 30 секунд, посчитано, а не с потолка:**
/// - `socket_io_client` (`enableReconnection()` в `SocketIoSqSocket`, без
///   переопределения дефолтов `Manager`: `reconnectionDelay` = 1000мс,
///   `reconnectionDelayMax` = 5000мс) в худшем реалистичном сценарии —
///   транспорт устанавливается и тут же обрывается вновь (нестабильный
///   радиоканал, сервер, отклоняющий соединение сразу после хендшейка) —
///   сбрасывает СВОЙ backoff к минимуму на каждом таком цикле
///   (`Manager.onclose` зовёт `_backoff.reset()`), то есть уже сам транспорт
///   способен генерировать `disconnected` примерно раз в 1–5 секунд
///   неограниченно долго. Порог этой функции обязан быть заметно больше
///   этого темпа, иначе он ничего не добавляет к тому, что и так даёт сам
///   `socket_io_client`.
/// - Access-токен живёт 15 минут (`JWT_ACCESS_TTL=15m`, `backend/.env`,
///   `AuthModule` — не рассуждение, а фактическое значение конфигурации).
///   30 секунд — это ~3.3% от этого окна: сессия, которой рефреш
///   действительно нужен, ждёт пренебрежимо мало по человеческим меркам
///   (индикатор «связь восстанавливается» у [SqSocket.connectionState] и
///   так уже показывает процесс восстановления пользователю).
/// - Итог: на порядок больше худшего собственного темпа транспорта
///   (1–5 с) и на два порядка меньше окна жизни токена (15 мин) — заметный
///   throttle, не мешающий обычному сценарию восстановления связи.
const Duration _authRefreshCooldown = Duration(seconds: 30);

/// Поднимает [SqEvents] поверх [socket] и держит его соединение в шаге с
/// access-токеном из [tokenStore]; при разрыве, похожем на отказ
/// аутентификации, проактивно обновляет токен через [refresh] и
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
/// настоящем отказе аутентификации (`401`) в проактивном рефреше ниже. Все
/// они в итоге вызывают
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
/// [tokenStore] ещё есть сессия, и не чаще раза в [_authRefreshCooldown] —
/// см. ниже) пробуем обновить токен через [refresh] и ждём, пока
/// `accessTokenChanges` сам поднимет переподключение — отдельно вызывать
/// `socket.connect` тут не нужно.
///
/// **Классификация исхода рефреша** (Round 3 ревью, п.1; переиграно Round 4,
/// п.1 — см. ниже): `401` на сам `/auth/refresh` — единственный код, которым
/// бэкенд отвечает на мёртвый refresh-токен (`AuthService.refresh`,
/// `apiError('UNAUTHORIZED', ..., 401)`), — а любой другой исход
/// ([ApiErrorCode.network] — нет сети/таймаут, `5xx`, что угодно ещё)
/// означает «попробуем позже» и не трогает ни [tokenStore], ни счётчики —
/// только ждёт следующего `disconnected` (ограниченного cooldown-ом ниже).
///
/// **Round 4 ревью, п.1 (Critical) — настоящий `401` инвалидирует
/// НЕМЕДЛЕННО, без повторных попыток.** Раньше (Round 3) `401` расходовал
/// бюджет и ждал его исчерпания, прежде чем инвалидировать — рассуждение
/// было «разлогин разрушителен, дадим второй шанс». Это было ошибкой:
/// второй попытке НЕ на что опереться. `TokenRefresher._doRefresh()`
/// перечитывает [tokenStore] при каждом вызове, но отзыв refresh-токена на
/// бэкенде НЕОБРАТИМ (`AuthService.refresh` — условный `updateMany` по
/// `revokedAt: null`, повторный `updateMany` тем же токеном снова
/// обновит 0 строк) — вторая попытка читает ТОТ ЖЕ самый мёртвый токен и
/// гарантированно получает ТОТ ЖЕ `401`. Бюджет для этой ветки не давал
/// второго шанса, а лишь откладывал неизбежное на один интервал
/// переподключения — и хуже того, ВРЕДНО откладывал: пользователь с мёртвой
/// сессией вместо честного возврата на экран входа видел «связь
/// восстанавливается», которое никогда не восстановится. Поэтому здесь
/// `401` сразу вызывает `tokenStore.clear()` + [onSessionInvalid] — без
/// счётчика, без второй попытки.
///
/// **Cooldown [_authRefreshCooldown] — на что он теперь и почему не
/// бюджет.** После снятия бюджета из ветки `401` (она инвалидирует
/// немедленно и больше не нуждается в ограничителе — см. выше) остаётся
/// один сценарий, которому throttle всё ещё нужен: болтающаяся связь, где
/// разрывы идут чередой, а `refresh()` каждый раз проваливается СЕТЕВОЙ
/// ошибкой (не отказом аутентификации). Здесь неверно спрашивать «сколько
/// раз подряд мы уже проиграли» (это и был старый, ошибочный вопрос
/// бюджета — сетевой сбой не повод разлогинивать, сколько бы раз он ни
/// повторился) — верный вопрос «не долбим ли мы `/auth/refresh` слишком
/// часто». Поэтому — простой cooldown по времени последней попытки, а не
/// накопительный счётчик: сколько угодно разрывов подряд внутри одного
/// окна [_authRefreshCooldown] стоят ОДНОЙ попытки, инвалидации по
/// «исчерпанию» нет вовсе. [now] — точка внедрения времени для
/// детерминированных тестов (`test/core/sq_events_connection_test.dart`),
/// в проде — `DateTime.now` по умолчанию.
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
  DateTime Function() now = DateTime.now,
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
  DateTime? lastAuthRefreshAttempt;
  final connectionSub = socket.connectionState.listen((state) {
    if (state != SqConnectionState.disconnected) return;
    unawaited(() async {
      final tokens = await tokenStore.read();
      if (tokens == null) return; // уже разлогинены — чинить нечего

      final attemptAt = now();
      final last = lastAuthRefreshAttempt;
      if (last != null && attemptAt.difference(last) < _authRefreshCooldown) {
        // Внутри cooldown-окна — этот разрыв просто пропускаем, не звоним
        // /auth/refresh лишний раз (см. [_authRefreshCooldown]).
        return;
      }
      lastAuthRefreshAttempt = attemptAt;

      try {
        // TokenRefresher.refresh() сам пишет результат в TokenStore —
        // переподключение запускается САМО через accessTokenChanges, здесь
        // писать токены повторно не нужно (и нельзя: второй write() того
        // же значения — лишняя, хоть и безобидная, реакция шины).
        await refresh();
      } on ApiException catch (e) {
        if (e.code != ApiErrorCode.unauthorized) {
          // Нет сети, таймаут, 5xx и всё прочее, кроме 401, — не отказ
          // аутентификации, а «попробуем позже»: сессию не чистим, ждём
          // следующего разрыва (не раньше cooldown).
          return;
        }
        // 401 на сам /auth/refresh — refresh-токен НЕОБРАТИМО мёртв на
        // бэкенде (Round 4 ревью, п.1 — см. комментарий выше), повторная
        // попытка ничего не изменит: инвалидируем сразу, без второй
        // попытки и без cooldown-ожидания.
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

/// Тело реального [sqEventsProvider] — как и [buildSqApi], перенесено сюда
/// задачей 2 (E7): сам провайдер теперь placeholder в `shared`
/// (`ChatController` переехал туда и читает `sqEventsProvider`), а `main()`
/// переопределяет его этой же функцией (`.overrideWith(buildSqEvents)`).
/// [connectSqEvents] — намеренно НЕ трогается этим переносом: вся
/// race-condition-чувствительная логика реконнекта остаётся здесь, как и
/// была, только точка её подключения к Riverpod теперь называется иначе.
///
/// `refresh: api.tokenRefresher.refresh` — намеренно НЕ `api.refresh`
/// (тот принимает конкретный refresh-токен и не координируется ни с чем):
/// `api.tokenRefresher` — ОДИН И ТОТ ЖЕ инстанс `TokenRefresher`, которым
/// внутри пользуется `AuthInterceptor` этого же `SqApi` — так HTTP-401 и
/// разрыв WS делят один single-flight, а не гоняются за один одноразовый
/// refresh-токен независимо (Round 2 ревью задачи 8, п.2).
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
