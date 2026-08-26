/// Состояние аутентификации эксперта и контроллер, который им управляет.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/providers.dart';
import '../data/auth_repository.dart';

/// Состояние аутентификации эксперта.
///
/// Три варианта: [AuthUnknown] (идёт восстановление сессии при старте
/// приложения), [AuthAnonymous] (сессии нет) и [AuthRegistered] (телефон
/// подтверждён). В отличие от `app_client` здесь НЕТ `AuthGuest` — у
/// эксперта не существует гостевого режима: анкета онбординга (следующие
/// задачи эпика E7) требует полноценной регистрации по телефону, поэтому
/// `AuthController` ниже намеренно не имеет метода `continueAsGuest()`.
sealed class AuthState {
  const AuthState();
}

/// Восстановление сессии ещё не завершилось.
class AuthUnknown extends AuthState {
  const AuthUnknown();
}

/// Сохранённой сессии нет.
class AuthAnonymous extends AuthState {
  const AuthAnonymous();
}

/// Профиль эксперта с подтверждённым телефоном.
class AuthRegistered extends AuthState {
  const AuthRegistered(this.user);
  final AuthUser user;
}

/// Управляет аутентификацией эксперта: вход по SMS-коду и восстановление
/// сессии при старте приложения. Всю работу с сетью и хранилищем делегирует
/// [AuthRepository] — сам контроллер отвечает только за состояние.
///
/// Стартовое состояние — [AuthUnknown]: восстановление сессии не
/// запускается автоматически в `build()`, его явно вызывает экран заставки
/// через [restore] (тот же принцип, что в `app_client`).
class AuthController extends AsyncNotifier<AuthState> {
  @override
  FutureOr<AuthState> build() {
    // Принудительный разлогин со стороны бэкенда идёт не прямым вызовом, а
    // реактивным сигналом из `core` — см. `sessionInvalidatedProvider` в
    // `core/providers.dart`.
    ref.listen<int>(sessionInvalidatedProvider, (previous, next) {
      state = const AsyncData(AuthAnonymous());
    });
    return const AuthUnknown();
  }

  AuthRepository get _repo => ref.read(authRepositoryProvider);

  /// Восстанавливает сессию — вызывается один раз при старте приложения
  /// (экраном заставки).
  ///
  /// Никогда не пробрасывает исключение: ошибка чтения хранилища
  /// трактуется как отсутствие сессии — иначе экран заставки завис бы на
  /// спиннере навсегда. Испорченные данные при этом best-effort
  /// подчищаются, но попытка очистки обёрнута своим отдельным `try/catch`.
  Future<void> restore() async {
    final Tokens? tokens;
    try {
      tokens = await _repo.restoredTokens();
    } catch (_) {
      try {
        await _repo.logout();
      } catch (_) {
        // Не удалось даже очистить — не страшно, цель не застрять на
        // AuthUnknown, а не физическая очистка сама по себе.
      }
      state = const AsyncData(AuthAnonymous());
      return;
    }
    state = AsyncData(_stateFor(tokens));
  }

  /// `POST /auth/request-code` — запросить SMS-код на [phone].
  Future<void> requestCode(String phone) => _repo.requestCode(phone);

  /// `POST /auth/verify-code` — подтвердить код и войти.
  ///
  /// При ошибке (например `SMS_CODE_INVALID`) состояние остаётся прежним, а
  /// [ApiException] пробрасывается вызывающему.
  Future<void> verifyCode(String phone, String code) async {
    final tokens = await _repo.verifyCode(phone, code);
    state = AsyncData(_stateFor(tokens));
  }

  /// Пользователь сам решил выйти: чистит хранилище и переводит состояние в
  /// [AuthAnonymous]. Принудительный разлогин со стороны бэкенда в этот
  /// метод не заходит — он приходит реактивно через
  /// [sessionInvalidatedProvider] (см. подписку в `build()`).
  Future<void> logout() async {
    await _repo.logout();
    state = const AsyncData(AuthAnonymous());
  }

  AuthState _stateFor(Tokens? tokens) {
    if (tokens == null) return const AuthAnonymous();
    return AuthRegistered(tokens.user);
  }
}

final authControllerProvider = AsyncNotifierProvider<AuthController, AuthState>(
  AuthController.new,
);

/// Есть ли у эксперта живая (зарегистрированная) сессия.
final hasSessionProvider = Provider<bool>((ref) {
  final state = ref.watch(authControllerProvider).valueOrNull;
  return state is AuthRegistered;
});
