// Тест реактивности TokenStore, добавленной задачей 8 (шина реалтайм-
// событий): `sqEventsProvider` должен узнавать о новом/протухшем
// access-токене без обратной зависимости `core -> features`
// (`AuthController` в `core` не виден), поэтому единственный канал —
// `TokenStore.accessTokenChanges`, транслирующий сам объект хранилища
// каждый `write()`/`clear()`, откуда бы их ни вызвали (явный вход,
// конверсия гостя, молчаливый рефреш `AuthInterceptor`, явный или
// принудительный логаут — все они в итоге вызывают методы ОДНОГО и того же
// инстанса `TokenStore` из `tokenStoreProvider`).
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/token_store.dart';

/// Тот же фейк, что и в `auth_controller_test.dart` — секьюрное хранилище
/// в памяти.
class _FakeSecureStore implements SecureStore {
  final Map<String, String> data = {};

  @override
  Future<String?> read(String key) async => data[key];

  @override
  Future<void> write(String key, String value) async => data[key] = value;

  @override
  Future<void> delete(String key) async => data.remove(key);
}

Tokens _tokens(String access) => Tokens(
  accessToken: access,
  refreshToken: 'refresh-$access',
  user: AuthUser(id: 'u1', phone: null, isGuest: true),
);

void main() {
  group('TokenStore.accessTokenChanges', () {
    test('write() транслирует новый access-токен', () async {
      final store = TokenStore(_FakeSecureStore());
      final received = <String?>[];
      final sub = store.accessTokenChanges.listen(received.add);

      await store.write(_tokens('t1'));
      await pumpEventQueue();

      expect(received, ['t1']);
      await sub.cancel();
    });

    test('clear() транслирует null', () async {
      final store = TokenStore(_FakeSecureStore());
      await store.write(_tokens('t1'));
      final received = <String?>[];
      final sub = store.accessTokenChanges.listen(received.add);

      await store.clear();
      await pumpEventQueue();

      expect(received, [null]);
      await sub.cancel();
    });

    test('несколько write() подряд (молчаливый рефреш) транслируют каждый токен по очереди', () async {
      final store = TokenStore(_FakeSecureStore());
      final received = <String?>[];
      final sub = store.accessTokenChanges.listen(received.add);

      await store.write(_tokens('t1'));
      await store.write(_tokens('t2'));
      await pumpEventQueue();

      expect(received, ['t1', 't2']);
      await sub.cancel();
    });

    test('broadcast: несколько подписчиков получают одно и то же событие', () async {
      final store = TokenStore(_FakeSecureStore());
      final a = <String?>[];
      final b = <String?>[];
      final subA = store.accessTokenChanges.listen(a.add);
      final subB = store.accessTokenChanges.listen(b.add);

      await store.write(_tokens('t1'));
      await pumpEventQueue();

      expect(a, ['t1']);
      expect(b, ['t1']);
      await subA.cancel();
      await subB.cancel();
    });
  });
}
