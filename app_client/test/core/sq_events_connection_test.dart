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
/// если тест сам не переопределил [refreshTokens].
({SqEvents events, Future<void> Function() dispose}) _connect(
  TokenStore store,
  SqSocket socket, {
  Future<Tokens> Function(String refreshToken)? refreshTokens,
  void Function()? onSessionInvalid,
}) => connectSqEvents(
  store,
  socket,
  refreshTokens:
      refreshTokens ??
      (_) async => throw StateError('refreshTokens не должен был вызваться'),
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
      expect(socket.connectCalls, isEmpty, reason: 'предусловие: сессии ещё не было');

      await store.write(_tokens('t1'));
      await pumpEventQueue();

      expect(socket.connectCalls, ['t1']);
      await connection.dispose();
    });

    test(
      'повторный write() (молчаливый рефреш AuthInterceptor) переустанавливает соединение новым токеном',
      () async {
        final store = TokenStore(_FakeSecureStore());
        final socket = _FakeSqSocket();
        final connection = _connect(store, socket);
        await store.write(_tokens('t1'));
        await pumpEventQueue();

        await store.write(_tokens('t2'));
        await pumpEventQueue();

        expect(socket.connectCalls, ['t1', 't2']);
        await connection.dispose();
      },
    );

    test('clear() (логаут — явный или принудительный) рвёт соединение', () async {
      final store = TokenStore(_FakeSecureStore());
      final socket = _FakeSqSocket();
      final connection = _connect(store, socket);
      await store.write(_tokens('t1'));
      await pumpEventQueue();

      await store.clear();
      await pumpEventQueue();

      expect(socket.disconnectCalls, 1);
      await connection.dispose();
    });

    test('dispose() отписывается — дальнейшие write() socket не трогают', () async {
      final store = TokenStore(_FakeSecureStore());
      final socket = _FakeSqSocket();
      final connection = _connect(store, socket);
      await pumpEventQueue();

      await connection.dispose();
      await store.write(_tokens('t1'));
      await pumpEventQueue();

      expect(socket.connectCalls, isEmpty);
    });

    test('events отдаёт SqEvents поверх переданного socket', () async {
      final store = TokenStore(_FakeSecureStore());
      final socket = _FakeSqSocket();
      final connection = _connect(store, socket);

      expect(connection.events, isA<SqEvents>());
      await connection.dispose();
    });
  });

  group('connectSqEvents — гонка перекрывающихся смен токена (Round 1, п.3)', () {
    test(
      'логаут во время ещё не завершившегося connect() не оставляет сокет '
      'подключённым устаревшим токеном',
      () async {
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
      },
    );
  });

  group('connectSqEvents — разрыв, похожий на отказ аутентификации (Round 1, п.4)', () {
    test(
      'разрыв связи запускает обновление токена через переданный refreshTokens '
      'и переподключение свежим токеном',
      () async {
        final store = TokenStore(_FakeSecureStore());
        await store.write(_tokens('old'));
        final socket = _FakeSqSocket();
        var invalidated = false;
        final connection = connectSqEvents(
          store,
          socket,
          refreshTokens: (refreshToken) async {
            expect(refreshToken, 'refresh-old');
            return _tokens('fresh');
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
      },
    );

    test(
      'провал рефреша с НЕ-сетевым кодом (мёртвый refresh-токен) очищает '
      'сессию и сигналит sessionInvalidatedProvider',
      () async {
        final store = TokenStore(_FakeSecureStore());
        await store.write(_tokens('old'));
        final socket = _FakeSqSocket();
        var invalidated = false;
        final connection = connectSqEvents(
          store,
          socket,
          refreshTokens: (_) async => throw const ApiException(
            ApiErrorCode.unauthorized,
            'refresh-токен тоже мёртв',
            401,
          ),
          onSessionInvalid: () => invalidated = true,
        );
        await pumpEventQueue();

        socket.pushConnectionState(SqConnectionState.connected);
        socket.pushConnectionState(SqConnectionState.disconnected);
        await pumpEventQueue();

        expect(invalidated, isTrue);
        expect(await store.read(), isNull);
        await connection.dispose();
      },
    );

    test(
      'провал рефреша с сетевым кодом НЕ инвалидирует сессию (временно нет '
      'сети — не повод разлогинивать)',
      () async {
        final store = TokenStore(_FakeSecureStore());
        await store.write(_tokens('old'));
        final socket = _FakeSqSocket();
        var invalidated = false;
        final connection = connectSqEvents(
          store,
          socket,
          refreshTokens: (_) async =>
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
      },
    );

    test(
      'бюджет попыток ограничен: несколько разрывов подряд без успешного '
      'connected между ними в итоге инвалидируют сессию',
      () async {
        final store = TokenStore(_FakeSecureStore());
        await store.write(_tokens('old'));
        final socket = _FakeSqSocket();
        var invalidated = false;
        var refreshCalls = 0;
        final connection = connectSqEvents(
          store,
          socket,
          refreshTokens: (_) async {
            refreshCalls++;
            return _tokens('fresh-$refreshCalls');
          },
          onSessionInvalid: () => invalidated = true,
        );
        await pumpEventQueue();

        // Три разрыва ПОДРЯД, ни разу не дойдя до connected.
        socket.pushConnectionState(SqConnectionState.disconnected);
        await pumpEventQueue();
        socket.pushConnectionState(SqConnectionState.disconnected);
        await pumpEventQueue();
        socket.pushConnectionState(SqConnectionState.disconnected);
        await pumpEventQueue();

        expect(
          refreshCalls,
          2,
          reason: 'бюджет — 2 попытки; третья должна была уже сдаться',
        );
        expect(invalidated, isTrue);
        await connection.dispose();
      },
    );

    test(
      'успешный connected сбрасывает бюджет — новая серия разрывов снова '
      'получает полный запас попыток',
      () async {
        final store = TokenStore(_FakeSecureStore());
        await store.write(_tokens('old'));
        final socket = _FakeSqSocket();
        var invalidated = false;
        var refreshCalls = 0;
        final connection = connectSqEvents(
          store,
          socket,
          refreshTokens: (_) async {
            refreshCalls++;
            return _tokens('fresh-$refreshCalls');
          },
          onSessionInvalid: () => invalidated = true,
        );
        await pumpEventQueue();

        socket.pushConnectionState(SqConnectionState.disconnected);
        await pumpEventQueue();
        socket.pushConnectionState(SqConnectionState.disconnected);
        await pumpEventQueue();
        // Между сериями — успешный connected: бюджет должен сброситься.
        socket.pushConnectionState(SqConnectionState.connected);
        await pumpEventQueue();
        socket.pushConnectionState(SqConnectionState.disconnected);
        await pumpEventQueue();
        socket.pushConnectionState(SqConnectionState.disconnected);
        await pumpEventQueue();

        expect(
          refreshCalls,
          4,
          reason: 'после сброса бюджета доступны ещё 2 попытки',
        );
        expect(invalidated, isFalse);
        await connection.dispose();
      },
    );

    test('пока в TokenStore нет сессии — разрыв не пытается рефрешить', () async {
      final store = TokenStore(_FakeSecureStore());
      final socket = _FakeSqSocket();
      var refreshCalls = 0;
      final connection = connectSqEvents(
        store,
        socket,
        refreshTokens: (_) async {
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
    });
  });
}
