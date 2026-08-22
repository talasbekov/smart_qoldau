// Тест реактивности TokenStore, добавленной задачей 8 (шина реалтайм-
// событий): `sqEventsProvider` должен узнавать о новом/протухшем
// access-токене без обратной зависимости `core -> features`
// (`AuthController` в `core` не виден), поэтому единственный канал —
// `TokenStore.accessTokenChanges`, транслирующий сам объект хранилища
// каждый `write()`/`clear()`, откуда бы их ни вызвали (явный вход,
// конверсия гостя, молчаливый рефреш `AuthInterceptor`, явный или
// принудительный логаут — все они в итоге вызывают методы ОДНОГО и того же
// инстанса `TokenStore` из `tokenStoreProvider`).
import 'dart:async';

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

/// Каждый `write()` ждёт [gate] — нужен, чтобы детерминированно (без
/// подбора таймингов) заставить `write()` и `clear()` перекрыться: тест
/// держит `write()` подвешенным и вызывает `clear()`, пока тот ещё не
/// начал писать, а затем сам решает, когда `write()` продолжится. Тот же
/// приём, что и `_DelayedOnboardingFlags`/явный `Completer` в тестах
/// задачи 6 (см. отчёт задачи 8, раунд правок 1).
class _GatedSecureStore implements SecureStore {
  _GatedSecureStore(this.gate);

  final Completer<void> gate;
  final Map<String, String> data = {};

  @override
  Future<String?> read(String key) async => data[key];

  @override
  Future<void> write(String key, String value) async {
    await gate.future;
    data[key] = value;
  }

  @override
  Future<void> delete(String key) async => data.remove(key);
}

/// Бросает ровно один раз на первом `write()`, дальше работает как
/// обычно — нужен для проверки, что сбой одной операции в очереди
/// `TokenStore._enqueue` не запирает последующие.
class _ThrowingOnceSecureStore implements SecureStore {
  final Map<String, String> data = {};
  var _thrown = false;

  @override
  Future<String?> read(String key) async => data[key];

  @override
  Future<void> write(String key, String value) async {
    if (!_thrown) {
      _thrown = true;
      throw Exception('boom');
    }
    data[key] = value;
  }

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

  group('TokenStore — очередь write()/clear() (Round 1 ревью задачи 8, п.3)', () {
    test(
      'write(), вызванный раньше, но завершающийся дольше, не даёт '
      'обогнать себя более быстрым clear() — уведомления идут в порядке '
      'вызова, а не завершения',
      () async {
        // Сценарий из ревью: молчаливый рефреш начал write() раньше, чем
        // пользователь успел разлогиниться, но его собственные внутренние
        // await медленнее, чем быстрый clear() логаута. Без очереди
        // clear() обогнал бы write(), и шина переподключилась бы для уже
        // закрытой сессии.
        final gate = Completer<void>();
        final store = TokenStore(_GatedSecureStore(gate));
        final received = <String?>[];
        final sub = store.accessTokenChanges.listen(received.add);

        final writeFuture = store.write(_tokens('refreshed'));
        await pumpEventQueue();
        expect(
          received,
          isEmpty,
          reason: 'write() всё ещё висит на gate — ничего не должно уйти',
        );

        final clearFuture = store.clear();
        await pumpEventQueue();
        expect(
          received,
          isEmpty,
          reason: 'clear() вызван позже write() — должен ждать своей очереди',
        );

        gate.complete();
        await writeFuture;
        await clearFuture;
        await pumpEventQueue();

        expect(
          received,
          ['refreshed', null],
          reason:
              'write() был ВЫЗВАН первым — его уведомление обязано прийти '
              'первым, даже если clear() физически завершился быстрее',
        );
        await sub.cancel();
      },
    );

    test(
      'сбой одной операции в очереди не запирает последующие '
      '(try/finally-принцип задачи 6, применённый к очереди)',
      () async {
        final store = TokenStore(_ThrowingOnceSecureStore());
        final received = <String?>[];
        final sub = store.accessTokenChanges.listen(received.add);

        await expectLater(store.write(_tokens('t1')), throwsException);
        await store.write(_tokens('t2'));
        await pumpEventQueue();

        expect(
          received,
          ['t2'],
          reason:
              'первый write() упал, но очередь обязана остаться рабочей для второго',
        );
        await sub.cancel();
      },
    );
  });
}
