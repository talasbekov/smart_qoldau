/// Секьюрное хранилище пары токенов сессии и профиля пользователя.
library;

import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared/shared.dart';

/// Узкий интерфейс поверх секьюрного хранилища ключ-значение.
///
/// `flutter_secure_storage` — платформенный плагин на `MethodChannel` и в
/// `flutter test` без подмены канала не отвечает вообще (обращение к нему
/// в юнит-тестах просто зависает/бросает `MissingPluginException`).
/// Вместо мока канала (в задаче 2 такой мок «протёк» на другие тесты
/// файла — см. `packages/shared/test/design/widgets_test.dart`) сужаем
/// поверхность до трёх методов: продакшен-реализация ([FlutterSecureStore])
/// оборачивает реальный плагин, а тесты подставляют простую
/// in-memory-реализацию через `Provider.overrideWithValue`.
abstract class SecureStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

/// Реализация [SecureStore] поверх настоящего [FlutterSecureStorage] —
/// используется в приложении (см. `secureStoreProvider` в `providers.dart`).
class FlutterSecureStore implements SecureStore {
  const FlutterSecureStore([this._storage = const FlutterSecureStorage()]);

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

const _accessKey = 'sq.access';
const _refreshKey = 'sq.refresh';
const _userKey = 'sq.user';

/// Хранит пару токенов сессии (`Tokens`) в [SecureStore].
///
/// Профиль пользователя (`AuthUser`) хранится рядом с токенами (JSON-строкой
/// под собственным ключом) — при восстановлении сессии (`AuthController
/// .restore()`) не нужен отдельный сетевой запрос, чтобы узнать
/// `isGuest`/`phone`: это ровно то, что позволяет гостевому профилю и
/// зарегистрированной сессии одинаково пережить перезапуск приложения.
class TokenStore {
  TokenStore(this._store);

  final SecureStore _store;

  /// Транслирует access-токен при каждом [write] и `null` при каждом
  /// [clear] — независимо от того, что именно вызвало запись: явный вход,
  /// конверсия гостя, молчаливый рефреш `AuthInterceptor` или логаут
  /// (явный и принудительный). Единственный канал, которым шина
  /// реалтайм-событий (`sqEventsProvider`, задача 8 эпика E6) узнаёт о
  /// новом/протухшем токене — без обратной зависимости `core -> features`
  /// (см. `sessionInvalidatedProvider` в `providers.dart` про тот же приём
  /// для принудительного логаута).
  ///
  /// Не несёт текущее значение сама по себе (это обычный `Stream`, не
  /// `ValueStream`) — токен, восстановленный из хранилища при холодном
  /// старте приложения (`AuthController.restore()`, только [read]), сюда
  /// не попадает; подписчику нужно ОТДЕЛЬНО досеять состояние вызовом
  /// [read] сразу после подписки.
  Stream<String?> get accessTokenChanges => _accessTokenChanges.stream;

  final _accessTokenChanges = StreamController<String?>.broadcast();

  /// Хвост очереди [write]/[clear] (Round 1 ревью задачи 8, п.3): без нЕЁ
  /// гонка «логаут против уже запущенного молчаливого рефреша» ломает
  /// порядок уведомлений — `write()` от рефреша мог быть ВЫЗВАН раньше
  /// `clear()` от логаута, но из-за собственных внутренних `await`
  /// ЗАВЕРШИТЬСЯ позже, и тогда `accessTokenChanges` получил бы сначала
  /// `null`, а потом СВЕЖИЙ токен — шина реалтайм-событий переподключилась
  /// бы для только что закрытой пользователем сессии. Очередь гарантирует:
  /// операции применяются (и уведомляют) СТРОГО в порядке вызова, а не в
  /// порядке завершения своих внутренних `await`.
  Future<void> _queue = Future<void>.value();

  /// Хвост очереди — единственная точка входа для [write]/[clear]; ошибка
  /// одной операции не должна разорвать очередь для последующих (иначе,
  /// например, сбой хранилища на логауте навсегда запер бы шину без
  /// возможности снова войти).
  Future<void> _enqueue(Future<void> Function() action) {
    final result = _queue.then((_) => action());
    _queue = result.catchError((_) {});
    return result;
  }

  /// Читает сохранённую пару токенов. `null`, если сессии ещё не было
  /// (хотя бы один из трёх ключей отсутствует).
  ///
  /// Намеренно НЕ идёт через очередь [write]/[clear] — восстановление
  /// сессии при старте приложения (`AuthController.restore()`) должно
  /// читать немедленно, а не ждать, пока разрешится произвольно долгая
  /// цепочка предыдущих операций (которых на холодном старте и быть не
  /// может).
  Future<Tokens?> read() async {
    final access = await _store.read(_accessKey);
    final refresh = await _store.read(_refreshKey);
    final userJson = await _store.read(_userKey);
    if (access == null || refresh == null || userJson == null) {
      return null;
    }
    return Tokens(
      accessToken: access,
      refreshToken: refresh,
      user: AuthUser.fromJson(jsonDecode(userJson) as Map<String, dynamic>),
    );
  }

  Future<void> write(Tokens tokens) => _enqueue(() async {
    await _store.write(_accessKey, tokens.accessToken);
    await _store.write(_refreshKey, tokens.refreshToken);
    await _store.write(_userKey, jsonEncode(tokens.user.toJson()));
    _accessTokenChanges.add(tokens.accessToken);
  });

  Future<void> clear() => _enqueue(() async {
    await _store.delete(_accessKey);
    await _store.delete(_refreshKey);
    await _store.delete(_userKey);
    _accessTokenChanges.add(null);
  });

  /// Закрывает [accessTokenChanges] — вызывается при уничтожении
  /// [tokenStoreProvider] (`ref.onDispose`), в тестах не обязателен.
  void dispose() => _accessTokenChanges.close();
}
