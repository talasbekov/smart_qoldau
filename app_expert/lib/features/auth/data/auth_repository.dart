/// Слой данных аутентификации: инкапсулирует обращения к `SqApi` и
/// персистентность сессии (`TokenStore`), чтобы `AuthController` занимался
/// только состоянием.
///
/// В отличие от `app_client/lib/features/auth/data/auth_repository.dart` —
/// НЕТ `continueAsGuest()`/`convertGuest()`: у эксперта нет гостевого
/// режима вовсе, регистрация только по телефону.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/providers.dart';
import '../../../core/token_store.dart';

class AuthRepository {
  AuthRepository(this._api, this._tokenStore);

  final SqApi _api;
  final TokenStore _tokenStore;

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

  /// Чистит сохранённую сессию.
  Future<void> logout() => _tokenStore.clear();
}

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) =>
      AuthRepository(ref.watch(sqApiProvider), ref.watch(tokenStoreProvider)),
);
