/// Слой данных аутентификации: инкапсулирует обращения к `SqApi` и
/// персистентность сессии (`TokenStore`, `deviceId`) за одним фасадом,
/// чтобы `AuthController` занимался только состоянием.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/device_id.dart';
import '../../../core/providers.dart';
import '../../../core/token_store.dart';

class AuthRepository {
  AuthRepository(this._api, this._tokenStore, this._secureStore);

  final SqApi _api;
  final TokenStore _tokenStore;
  final SecureStore _secureStore;

  /// Токены, сохранённые с прошлого запуска приложения, либо `null`, если
  /// сессии не было.
  Future<Tokens?> restoredTokens() => _tokenStore.read();

  /// `POST /auth/request-code`.
  Future<void> requestCode(String phone) => _api.requestCode(phone);

  /// `POST /auth/verify-code` + сохранение полученных токенов.
  Future<Tokens> verifyCode(String phone, String code) async {
    final tokens = await _api.verifyCode(phone, code);
    await _tokenStore.write(tokens);
    return tokens;
  }

  /// `POST /auth/guest` по идентификатору устройства (БП-10, Р-22) +
  /// сохранение полученных токенов.
  Future<Tokens> continueAsGuest() async {
    final id = await deviceId(_secureStore);
    final tokens = await _api.guestLogin(id);
    await _tokenStore.write(tokens);
    return tokens;
  }

  /// `POST /auth/guest/convert` + сохранение полученных токенов.
  Future<Tokens> convertGuest(String phone, String code) async {
    final tokens = await _api.convertGuest(phone, code);
    await _tokenStore.write(tokens);
    return tokens;
  }

  /// Чистит сохранённую сессию.
  Future<void> logout() => _tokenStore.clear();
}

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(
    ref.watch(sqApiProvider),
    ref.watch(tokenStoreProvider),
    ref.watch(secureStoreProvider),
  ),
);
