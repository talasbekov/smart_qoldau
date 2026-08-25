/// Секьюрное хранилище пары токенов сессии и профиля эксперта.
///
/// Копия `app_client/lib/core/token_store.dart` — тот же контракт
/// (`SecureStore`, ключи, очередь `write`/`clear`, `accessTokenChanges`),
/// `packages/shared` задача 1 не меняет, поэтому переиспользовать нечего
/// без образования обратной зависимости `shared -> app`.
library;

import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared/shared.dart';

/// Узкий интерфейс поверх секьюрного хранилища ключ-значение.
///
/// `flutter_secure_storage` — платформенный плагин на `MethodChannel`,
/// недоступный в `flutter test` без подмены канала; тесты подставляют
/// простую in-memory-реализацию через `Provider.overrideWithValue`.
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

/// Хранит пару токенов сессии (`Tokens`) и профиль эксперта (`AuthUser`) в
/// [SecureStore].
class TokenStore {
  TokenStore(this._store);

  final SecureStore _store;

  /// Транслирует access-токен при каждом [write] и `null` при каждом
  /// [clear] — единственный канал, которым будущая шина реалтайм-событий
  /// узнаёт о новом/протухшем токене (тот же приём, что в `app_client`).
  Stream<String?> get accessTokenChanges => _accessTokenChanges.stream;

  final _accessTokenChanges = StreamController<String?>.broadcast();

  /// Хвост очереди [write]/[clear] — операции применяются (и уведомляют)
  /// строго в порядке ВЫЗОВА, а не в порядке завершения своих внутренних
  /// `await` (см. обоснование в `app_client/lib/core/token_store.dart`).
  Future<void> _queue = Future<void>.value();

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
  /// читать немедленно.
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
