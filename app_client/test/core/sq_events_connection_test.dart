// Тест «неочевидного места» задачи 8 (см. брифинг эпика E6): как шина
// реалтайм-событий узнаёт о появлении/смене/исчезновении access-токена.
// `connectSqEvents` — вынесенная из тела `sqEventsProvider` чистая функция
// (без Riverpod, без сети) именно для того, чтобы это место можно было
// проверить фейковым `SqSocket`, а не полагаться на прогон против реального
// сокета.
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
class _FakeSqSocket implements SqSocket {
  final List<String> connectCalls = [];
  int disconnectCalls = 0;

  @override
  Stream<(String, dynamic)> get events => const Stream.empty();

  @override
  void emit(String event, dynamic data) {}

  @override
  Future<void> connect(String token) async => connectCalls.add(token);

  @override
  Future<void> disconnect() async => disconnectCalls++;
}

Tokens _tokens(String access) => Tokens(
  accessToken: access,
  refreshToken: 'refresh-$access',
  user: AuthUser(id: 'u1', phone: null, isGuest: true),
);

void main() {
  group('connectSqEvents', () {
    test(
      'холодный старт с уже сохранённой сессией досеивает и подключается',
      () async {
        final store = TokenStore(_FakeSecureStore());
        await store.write(_tokens('restored'));
        final socket = _FakeSqSocket();

        final connection = connectSqEvents(store, socket);
        await pumpEventQueue();

        expect(socket.connectCalls, ['restored']);
        await connection.dispose();
      },
    );

    test('новый токен (явный вход) подключает', () async {
      final store = TokenStore(_FakeSecureStore());
      final socket = _FakeSqSocket();
      final connection = connectSqEvents(store, socket);
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
        final connection = connectSqEvents(store, socket);
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
      final connection = connectSqEvents(store, socket);
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
      final connection = connectSqEvents(store, socket);
      await pumpEventQueue();

      await connection.dispose();
      await store.write(_tokens('t1'));
      await pumpEventQueue();

      expect(socket.connectCalls, isEmpty);
    });

    test('events отдаёт SqEvents поверх переданного socket', () async {
      final store = TokenStore(_FakeSecureStore());
      final socket = _FakeSqSocket();
      final connection = connectSqEvents(store, socket);

      expect(connection.events, isA<SqEvents>());
      await connection.dispose();
    });
  });
}
