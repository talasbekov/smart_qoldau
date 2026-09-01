// Тест «неочевидного места» задачи 8 (см. брифинг эпика E6): как шина
// реалтайм-событий узнаёт о появлении/смене/исчезновении access-токена, как
// она переживает гонки перекрывающихся смен токена (Round 1 ревью, п.3) и
// как реагирует на разрыв, похожий на отказ аутентификации (Round 1 ревью,
// п.4). `connectSqEvents` — вынесенная из тела `sqEventsProvider` чистая
// функция (без Riverpod, без сети) именно для того, чтобы всё это можно
// было проверить фейковыми `SqSocket`/`TokenStore`, а не полагаться на
// прогон против реального сокета.
import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/providers.dart';
import 'package:app_client/core/token_store.dart';

class _FakeSecureStore implements SecureStore {
  final Map<String, String> data = {};

  @override
  Future<String?> read(String key) async => data[key];

  @override
  Future<void> write(String key, String value) async => data[key] = value;

  @override
  Future<void> delete(String key) async => data.remove(key);
}

/// Фейковый транспорт: без сети, только запись вызовов.
///
/// [connectGate], если задан, заставляет `connect()` дождаться его —
/// единственный способ детерминированно (без подбора таймингов) заставить
/// два применения токена перекрыться по-настоящему, тот же приём, что и
/// `Completer`-затворы в тестах задачи 6 (см. отчёт задачи 8).
class _FakeSqSocket implements SqSocket {
  final List<String> connectCalls = [];
  int disconnectCalls = 0;
  Completer<void>? connectGate;

  final _connectionStateController =
      StreamController<SqConnectionState>.broadcast();

  bool? _lastAppliedConnected;

  @override
  Stream<(String, dynamic)> get events => const Stream.empty();

  @override
  Stream<SqConnectionState> get connectionState =>
      _connectionStateController.stream;

  void pushConnectionState(SqConnectionState state) =>
      _connectionStateController.add(state);

  @override
  void emit(String event, dynamic data) {}

  @override
  Future<void> connect(String token) async {
    final gate = connectGate;
    if (gate != null) await gate.future;
    connectCalls.add(token);
    _lastAppliedConnected = true;
  }

  @override
  Future<void> disconnect() async {
    disconnectCalls++;
    _lastAppliedConnected = false;
  }

  /// Итоговое состояние по факту ПОСЛЕДНЕЙ реально выполненной операции —
  /// не путать с `connectionState` (тот транспортный, тут — что мы сами
  /// вызвали последним).
  bool get isConnectedFinal => _lastAppliedConnected ?? false;
}

Tokens _tokens(String access) => Tokens(
  accessToken: access,
  refreshToken: 'refresh-$access',
  user: AuthUser(id: 'u1', phone: null, isGuest: true),
);

/// Обёртка над [connectSqEvents] с безобидными дефолтами для тестов,
/// которым п.4 (проактивный рефреш) не важен — не должен вызываться вовсе,
/// если тест сам не переопределил [refresh].
({SqEvents events, Future<void> Function() dispose}) _connect(
  TokenStore store,
  SqSocket socket, {
  Future<Tokens> Function()? refresh,
  void Function()? onSessionInvalid,
}) => connectSqEvents(
  store,
  socket,
  refresh:
      refresh ??
      () async => throw StateError('refresh не должен был вызваться'),
  onSessionInvalid: onSessionInvalid ?? () {},
);

void main() {
  group('connectSqEvents — применение токена', () {
    test(
      'холодный старт с уже сохранённой сессией досеивает и подключается',
      () async {
        final store = TokenStore(_FakeSecureStore());
        await store.write(_tokens('restored'));
        final socket = _FakeSqSocket();

        final connection = _connect(store, socket);
        await pumpEventQueue();

        expect(socket.connectCalls, ['restored']);
        await connection.dispose();
      },
    );

    test('новый токен (явный вход) подключает', () async {
      final store = TokenStore(_FakeSecureStore());
      final socket = _FakeSqSocket();
      final connection = _connect(store, socket);
      await pumpEventQueue();
      expect(
        socket.connectCalls,
        isEmpty,
        reason: 'предусловие: сессии ещё не было',
      );

      await store.write(_tokens('t1'));
      await pumpEventQueue();

      expect(socket.connectCalls, ['t1']);
      await connection.dispose();
    });

    test('повторный write() (молчаливый рефреш AuthInterceptor) переустанавливает соединение новым токеном', () async {
      final store = TokenStore(_FakeSecureStore());
      final socket = _FakeSqSocket();
      final connection = _connect(store, socket);
      await store.write(_tokens('t1'));
      await pumpEventQueue();

      await store.write(_tokens('t2'));
      await pumpEventQueue();

      expect(socket.connectCalls, ['t1', 't2']);
      await connection.dispose();
    });

    test(
      'clear() (логаут — явный или принудительный) рвёт соединение',
      () async {
        final store = TokenStore(_FakeSecureStore());
        final socket = _FakeSqSocket();
        final connection = _connect(store, socket);
        await store.write(_tokens('t1'));
        await pumpEventQueue();

        await store.clear();
        await pumpEventQueue();

        expect(socket.disconnectCalls, 1);
        await connection.dispose();
      },
    );

    test(
      'dispose() отписывается — дальнейшие write() socket не трогают',
      () async {
        final store = TokenStore(_FakeSecureStore());
        final socket = _FakeSqSocket();
        final connection = _connect(store, socket);
        await pumpEventQueue();

        await connection.dispose();
        await store.write(_tokens('t1'));
        await pumpEventQueue();

        expect(socket.connectCalls, isEmpty);
      },
    );

    test('events отдаёт SqEvents поверх переданного socket', () async {
      final store = TokenStore(_FakeSecureStore());
      final socket = _FakeSqSocket();
      final connection = _connect(store, socket);

      expect(connection.events, isA<SqEvents>());
      await connection.dispose();
    });
  });

  group(
    'connectSqEvents — гонка перекрывающихся смен токена (Round 1, п.3)',
    () {
      test('логаут во время ещё не завершившегося connect() не оставляет сокет '
          'подключённым устаревшим токеном', () async {
        // Сценарий из ревью: connect('A') запущен, но ещё не выполнился
        // (завис на gate), когда приходит clear() — потенциальный «победитель»
        // (A) не должен переписать состояние поверх более позднего логаута.
        final store = TokenStore(_FakeSecureStore());
        final socket = _FakeSqSocket();
        final gate = Completer<void>();
        socket.connectGate = gate;
        final connection = _connect(store, socket);

        await store.write(_tokens('A'));
        await pumpEventQueue();
        expect(
          socket.connectCalls,
          isEmpty,
          reason: 'connect(A) должен всё ещё висеть на gate',
        );

        await store.clear();
        await pumpEventQueue();

        gate.complete();
        await pumpEventQueue();

        expect(
          socket.isConnectedFinal,
          isFalse,
          reason:
              'даже если connect(A) выполнился ПОСЛЕ disconnect(), итоговое '
              'состояние обязано отражать более позднее решение — логаут',
        );
        await connection.dispose();
      });
    },
  );

  group('connectSqEvents — разрыв, похожий на отказ аутентификации (Round 1 п.4, Round 2 п.1/2, Round 3 п.1, Round 4 п.1/2)', () {
    test('разрыв связи запускает обновление токена через переданный refresh '
        'и переподключение свежим токеном', () async {
      final store = TokenStore(_FakeSecureStore());
      await store.write(_tokens('old'));
      final socket = _FakeSqSocket();
      var invalidated = false;
      // Фейк здесь стоит на месте TokenRefresher.refresh — как и он,
      // сам пишет результат в TokenStore (connectSqEvents больше этого
      // не делает, см. Round 2 п.2).
      final connection = connectSqEvents(
        store,
        socket,
        refresh: () async {
          final fresh = _tokens('fresh');
          await store.write(fresh);
          return fresh;
        },
        onSessionInvalid: () => invalidated = true,
      );
      await pumpEventQueue();
      expect(socket.connectCalls, ['old']);

      socket.pushConnectionState(SqConnectionState.connected);
      socket.pushConnectionState(SqConnectionState.disconnected);
      await pumpEventQueue();

      expect(socket.connectCalls, ['old', 'fresh']);
      expect(invalidated, isFalse);
      expect((await store.read())?.accessToken, 'fresh');
      await connection.dispose();
    });

    test('настоящий 401 на /auth/refresh инвалидирует сессию НЕМЕДЛЕННО, с '
        'первой же попытки (Round 4, п.1 — отменяет решение Round 3: повтор '
        'структурно обречён, отзыв refresh-токена на бэкенде необратим, '
        'вторая попытка гарантированно получила бы тот же 401)', () async {
      final store = TokenStore(_FakeSecureStore());
      await store.write(_tokens('old'));
      final socket = _FakeSqSocket();
      var invalidated = false;
      var refreshCalls = 0;
      final connection = connectSqEvents(
        store,
        socket,
        refresh: () async {
          refreshCalls++;
          throw const ApiException(
            ApiErrorCode.unauthorized,
            'refresh-токен тоже мёртв',
            401,
          );
        },
        onSessionInvalid: () => invalidated = true,
      );
      await pumpEventQueue();

      socket.pushConnectionState(SqConnectionState.connected);
      socket.pushConnectionState(SqConnectionState.disconnected);
      await pumpEventQueue();

      expect(refreshCalls, 1);
      expect(invalidated, isTrue);
      expect(await store.read(), isNull);
      await connection.dispose();
    });

    test(
      'три подряд разрыва, где рефреш падает СЕТЕВОЙ ошибкой, НЕ инвалидируют '
      'сессию — cooldown схлопывает их в ОДНУ попытку (Round 4, п.2)',
      () async {
        final store = TokenStore(_FakeSecureStore());
        await store.write(_tokens('old'));
        final socket = _FakeSqSocket();
        var invalidated = false;
        var refreshCalls = 0;
        final connection = connectSqEvents(
          store,
          socket,
          refresh: () async {
            refreshCalls++;
            throw const ApiException(ApiErrorCode.network, 'нет сети', 0);
          },
          onSessionInvalid: () => invalidated = true,
          // Фиксированное "сейчас" — детерминированно держит все три
          // разрыва ВНУТРИ одного cooldown-окна, не полагаясь на то, что
          // тест физически выполнится быстрее 30 секунд по часам машины.
          now: () => DateTime(2026),
        );
        await pumpEventQueue();

        socket.pushConnectionState(SqConnectionState.disconnected);
        await pumpEventQueue();
        socket.pushConnectionState(SqConnectionState.disconnected);
        await pumpEventQueue();
        socket.pushConnectionState(SqConnectionState.disconnected);
        await pumpEventQueue();

        expect(
          refreshCalls,
          1,
          reason:
              'первый разрыв тратит попытку, второй и третий — внутри '
              'cooldown-окна и не должны звонить /auth/refresh повторно',
        );
        expect(invalidated, isFalse);
        expect(
          (await store.read())?.accessToken,
          'old',
          reason: 'сессия жива — сеть может вернуться сама',
        );
        await connection.dispose();
      },
    );

    test('cooldown — это интервал, а не счётчик: сколько угодно сетевых '
        'разрывов внутри окна остаются ОДНОЙ попыткой и НИКОГДА не '
        'инвалидируют сессию; по истечении окна разрешена следующая попытка '
        '(Round 4, п.2 — заменяет бывший счётчик-бюджет, который на N+1-м '
        'разрыве ПОДРЯД инвалидировал бы полностью живую, просто '
        'нестабильную сессию)', () async {
      final store = TokenStore(_FakeSecureStore());
      await store.write(_tokens('old'));
      final socket = _FakeSqSocket();
      var invalidated = false;
      var refreshCalls = 0;
      var fakeNow = DateTime(2026);
      final connection = connectSqEvents(
        store,
        socket,
        refresh: () async {
          refreshCalls++;
          throw const ApiException(ApiErrorCode.network, 'нет сети', 0);
        },
        onSessionInvalid: () => invalidated = true,
        now: () => fakeNow,
      );
      await pumpEventQueue();

      // Пять разрывов ПОДРЯД внутри одного окна cooldown — со старым
      // бюджетом (2 попытки) это уже трижды хватило бы на инвалидацию
      // полностью живой сессии.
      for (var i = 0; i < 5; i++) {
        socket.pushConnectionState(SqConnectionState.disconnected);
        await pumpEventQueue();
      }
      expect(refreshCalls, 1);
      expect(invalidated, isFalse);

      // Время ушло дальше cooldown-окна (30 секунд, см.
      // `_authRefreshCooldown` в providers.dart) — следующий разрыв
      // снова вправе попробовать рефреш.
      fakeNow = fakeNow.add(const Duration(seconds: 31));
      socket.pushConnectionState(SqConnectionState.disconnected);
      await pumpEventQueue();

      expect(refreshCalls, 2);
      expect(invalidated, isFalse);
      expect(
        (await store.read())?.accessToken,
        'old',
        reason:
            'сессия жива сколь угодно долго — сетевой сбой никогда не '
            'повод разлогинивать, вне зависимости от числа попыток',
      );
      await connection.dispose();
    });

    test('провал рефреша с 5xx (не 401) НЕ инвалидирует — «попробуем позже», '
        'как и сетевая ошибка', () async {
      final store = TokenStore(_FakeSecureStore());
      await store.write(_tokens('old'));
      final socket = _FakeSqSocket();
      var invalidated = false;
      final connection = connectSqEvents(
        store,
        socket,
        refresh: () async => throw const ApiException(
          ApiErrorCode.internal,
          'бэкенд временно недоступен',
          500,
        ),
        onSessionInvalid: () => invalidated = true,
      );
      await pumpEventQueue();

      socket.pushConnectionState(SqConnectionState.disconnected);
      await pumpEventQueue();

      expect(invalidated, isFalse);
      expect((await store.read())?.accessToken, 'old');
      await connection.dispose();
    });

    test('провал рефреша с сетевым кодом НЕ инвалидирует сессию (временно нет '
        'сети — не повод разлогинивать)', () async {
      final store = TokenStore(_FakeSecureStore());
      await store.write(_tokens('old'));
      final socket = _FakeSqSocket();
      var invalidated = false;
      final connection = connectSqEvents(
        store,
        socket,
        refresh: () async =>
            throw const ApiException(ApiErrorCode.network, 'нет сети', 0),
        onSessionInvalid: () => invalidated = true,
      );
      await pumpEventQueue();

      socket.pushConnectionState(SqConnectionState.connected);
      socket.pushConnectionState(SqConnectionState.disconnected);
      await pumpEventQueue();

      expect(invalidated, isFalse);
      expect(
        (await store.read())?.accessToken,
        'old',
        reason: 'сессия сохраняется — сеть может вернуться сама',
      );
      await connection.dispose();
    });

    test(
      'пока в TokenStore нет сессии — разрыв не пытается рефрешить',
      () async {
        final store = TokenStore(_FakeSecureStore());
        final socket = _FakeSqSocket();
        var refreshCalls = 0;
        final connection = connectSqEvents(
          store,
          socket,
          refresh: () async {
            refreshCalls++;
            return _tokens('should-not-happen');
          },
          onSessionInvalid: () {},
        );
        await pumpEventQueue();

        socket.pushConnectionState(SqConnectionState.disconnected);
        await pumpEventQueue();

        expect(refreshCalls, 0);
        await connection.dispose();
      },
    );

    test('обычный молчаливый рефреш, который НЕ порождает событие '
        'connectionState (корректный транспорт), не запускает refresh() '
        'повторно', () async {
      // Round 2 ревью, п.1 (Critical): исходный баг был в том, что
      // SocketIoSqSocket публиковал `disconnected` для КАЖДОГО
      // переподключения (в т.ч. штатного молчаливого рефреша — его
      // преамбула connect() сама рвёт предыдущий живой сокет), и
      // connectSqEvents принимал это за отказ аутентификации. Фикс —
      // целиком на уровне транспорта (`SocketIoSqSocket` больше не
      // публикует `disconnected` для причины `'io client disconnect'`,
      // см. `sq_socket.dart`); авторитетная проверка ИМЕННО этого —
      // `packages/shared/test/events/socket_io_sq_socket_test.dart`
      // (реальный `SocketIoSqSocket` против локального сервера).
      //
      // Здесь же — дополнение с другой стороны контракта: ДАН
      // корректно ведущий себя транспорт (не публикующий ничего лишнего
      // при обычном reconnect), `connectSqEvents` обязан молчать сам по
      // себе, а не находить собственный повод вызвать refresh() —
      // ловит регресс, если кто-то однажды подвяжет реакцию не к
      // `connectionState`, а напрямую к `accessTokenChanges`.
      final store = TokenStore(_FakeSecureStore());
      await store.write(_tokens('old'));
      final socket = _FakeSqSocket();
      var invalidated = false;
      var refreshCalls = 0;
      final connection = connectSqEvents(
        store,
        socket,
        refresh: () async {
          refreshCalls++;
          return _tokens('should-not-be-called');
        },
        onSessionInvalid: () => invalidated = true,
      );
      await pumpEventQueue();
      expect(socket.connectCalls, ['old']);

      // Штатный молчаливый рефреш: пишет новый токен, но НЕ эмитит
      // никакого connectionState — именно так теперь ведёт себя
      // корректный транспорт при обычном reconnect.
      await store.write(_tokens('new'));
      await pumpEventQueue();

      expect(socket.connectCalls, ['old', 'new']);
      expect(refreshCalls, 0);
      expect(invalidated, isFalse);
      await connection.dispose();
    });
  });
}
