/// Состояние аутентификации клиента и контроллер, который им управляет.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared/shared.dart';

import '../../../core/providers.dart';
import '../data/auth_repository.dart';

/// Состояние аутентификации клиента.
///
/// Четыре варианта: [AuthUnknown] (идёт восстановление сессии при старте
/// приложения), [AuthAnonymous] (сессии нет — ни гостевой, ни
/// зарегистрированной), [AuthGuest] (гостевой профиль, device-scoped,
/// Р-22) и [AuthRegistered] (телефон подтверждён). Вариант назван
/// `AuthRegistered`, а не `AuthUser` — имя `AuthUser` уже занято моделью
/// профиля из пакета `shared`.
sealed class AuthState {
  const AuthState();
}

/// Восстановление сессии ещё не завершилось.
class AuthUnknown extends AuthState {
  const AuthUnknown();
}

/// Сохранённой сессии нет — ни гостевой, ни зарегистрированной.
class AuthAnonymous extends AuthState {
  const AuthAnonymous();
}

/// Гостевой профиль, привязанный к устройству (Р-22).
class AuthGuest extends AuthState {
  const AuthGuest(this.user);
  final AuthUser user;
}

/// Профиль с подтверждённым телефоном.
class AuthRegistered extends AuthState {
  const AuthRegistered(this.user);
  final AuthUser user;
}

/// Управляет аутентификацией клиента: вход по SMS-коду, анонимный
/// (гостевой) доступ и восстановление сессии при старте приложения.
/// Всю работу с сетью и хранилищем делегирует [AuthRepository] — сам
/// контроллер отвечает только за состояние.
///
/// Стартовое состояние — [AuthUnknown]: восстановление сессии не
/// запускается автоматически в `build()` (см. разрешение неоднозначностей
/// задачи 5 эпика E6), его явно вызывает экран заставки через [restore].
class AuthController extends AsyncNotifier<AuthState> {
  @override
  FutureOr<AuthState> build() {
    // Принудительный разлогин со стороны бэкенда (`AuthInterceptor` не смог
    // обновить протухший токен) идёт не прямым вызовом, а реактивным
    // сигналом из `core` — см. `sessionInvalidatedProvider` в
    // `core/providers.dart` про то, почему это разорвало цикл импортов
    // `core → features`. `ref.listen` внутри `build()` — штатный,
    // безопасный способ Riverpod подписаться на другой провайдер без
    // побочных эффектов в момент самого построения: подписка происходит
    // сразу, а `state = ...` сработает позже, только когда сигнал реально
    // придёт.
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
  /// (инвалидация Android keystore, повреждённый/устаревший JSON под
  /// `sq.user`, который больше не разбирается `AuthUser.fromJson`, и т.п.)
  /// трактуется как отсутствие сессии — иначе экран заставки, который
  /// просто `await`-ит этот метод, завис бы на спиннере навсегда.
  ///
  /// Испорченные данные при этом best-effort подчищаются, чтобы не
  /// спотыкаться о них на каждом следующем запуске, — но попытка очистки
  /// обёрнута СВОИМ отдельным `try/catch`: если хранилище недоступно
  /// целиком (та же инвалидация keystore, из-за которой упало чтение,
  /// вполне может уронить и `delete()`), сбой очистки не должен помешать
  /// переходу в [AuthAnonymous] — приложение обязано доехать до экрана
  /// приветствия даже если от хранилища вообще ничего не добиться.
  Future<void> restore() async {
    final Tokens? tokens;
    try {
      tokens = await _repo.restoredTokens();
    } catch (_) {
      try {
        await _repo.logout();
      } catch (_) {
        // Не удалось даже очистить — не страшно, физическая очистка тут
        // не цель сама по себе, цель — не застрять на AuthUnknown.
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
  /// При ошибке (например `SMS_CODE_INVALID`) состояние остаётся прежним,
  /// а [ApiException] пробрасывается вызывающему — экран сам решает, как
  /// показать ошибку (см. `errorText`).
  Future<void> verifyCode(String phone, String code) async {
    final tokens = await _repo.verifyCode(phone, code);
    state = AsyncData(_stateFor(tokens));
  }

  /// `POST /auth/guest` — анонимный вход по идентификатору устройства
  /// (БП-10, Р-22). Один и тот же `deviceId` переживает перезапуск
  /// приложения и повторные вызовы.
  Future<void> continueAsGuest() async {
    final tokens = await _repo.continueAsGuest();
    state = AsyncData(_stateFor(tokens));
  }

  /// `POST /auth/guest/convert` — конверсия гостя в аккаунт по телефону
  /// (Р-22).
  Future<void> convertGuest(String phone, String code) async {
    final tokens = await _repo.convertGuest(phone, code);
    state = AsyncData(_stateFor(tokens));
  }

  /// Пользователь сам решил выйти: чистит хранилище и переводит состояние
  /// в [AuthAnonymous]. Принудительный разлогин со стороны бэкенда (когда
  /// `AuthInterceptor` не смог обновить протухший токен) в этот метод не
  /// заходит — он приходит реактивно через [sessionInvalidatedProvider]
  /// (см. подписку в `build()`).
  Future<void> logout() async {
    await _repo.logout();
    state = const AsyncData(AuthAnonymous());
  }

  AuthState _stateFor(Tokens? tokens) {
    if (tokens == null) return const AuthAnonymous();
    return tokens.user.isGuest
        ? AuthGuest(tokens.user)
        : AuthRegistered(tokens.user);
  }
}

final authControllerProvider = AsyncNotifierProvider<AuthController, AuthState>(
  AuthController.new,
);
