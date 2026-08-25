/// Навигация-оболочка приложения эксперта: редирект-гард сессии и таблица
/// маршрутов (`go_router`).
///
/// В отличие от `app_client/lib/router.dart` ветвей (каталог/консультации/
/// профиль и т.п.) здесь ещё нет — они появятся в последующих задачах
/// эпика E7 (онбординг-анкета, расписание, заявки, заработок). Задача 1
/// заводит только гард сессии: `AuthUnknown` → `/splash`, `AuthAnonymous` →
/// `/welcome`, иначе — `/home` (заглушка [AppShell]).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/route_paths.dart';
import 'features/auth/state/auth_controller.dart';
import 'features/auth/ui/phone_screen.dart';
import 'features/auth/ui/splash_screen.dart';
import 'features/shell/ui/app_shell.dart';

/// Пути, на которых эксперт обязан ОСТАВАТЬСЯ, пока не выполнено их
/// условие (см. [_redirect]), и с которых он обязан УЙТИ, как только оно
/// выполнено.
const _gatedPaths = {RoutePaths.splash, RoutePaths.welcome};

/// Реактивно просит `GoRouter` заново вычислить [_redirect], когда меняется
/// состояние аутентификации.
class _AuthRefreshNotifier extends ChangeNotifier {
  _AuthRefreshNotifier(Ref ref) {
    ref.listen<AsyncValue<AuthState>>(
      authControllerProvider,
      (previous, next) => notifyListeners(),
    );
  }
}

/// Редирект-гард сессии: `AuthUnknown` → `/splash`; `AuthAnonymous` →
/// `/welcome` (вход по телефону — гостевого режима нет); авторизован →
/// `/home`. Читает состояние через `ref.read`, а не `ref.watch` — эту
/// функцию вызывает сам `go_router`, а не Riverpod (тот же принцип, что в
/// `app_client/lib/router.dart`).
String? _redirect(Ref ref, GoRouterState state) {
  final location = state.matchedLocation;
  final authState = ref.read(authControllerProvider).valueOrNull;

  if (authState == null || authState is AuthUnknown) {
    return location == RoutePaths.splash ? null : RoutePaths.splash;
  }
  if (authState is AuthAnonymous) {
    return location == RoutePaths.welcome ? null : RoutePaths.welcome;
  }

  // Авторизован (AuthRegistered) — на "гейтовых" путях делать больше
  // нечего.
  if (_gatedPaths.contains(location)) return RoutePaths.home;
  return null;
}

/// Собирает `GoRouter` приложения. Принимает `Ref`, а не `WidgetRef` —
/// вызывается один раз из [routerProvider], а не из виджета.
GoRouter sqExpertRouter(Ref ref) {
  final refresh = _AuthRefreshNotifier(ref);

  return GoRouter(
    initialLocation: RoutePaths.splash,
    refreshListenable: refresh,
    redirect: (context, state) => _redirect(ref, state),
    routes: [
      GoRoute(
        path: RoutePaths.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: RoutePaths.welcome,
        builder: (context, state) => const PhoneScreen(),
      ),
      GoRoute(
        path: RoutePaths.home,
        builder: (context, state) => const AppShell(),
      ),
    ],
  );
}

/// `GoRouter` приложения — единственный инстанс на всё время жизни
/// `ProviderScope` (пересоздание сбросило бы стек навигации).
final routerProvider = Provider<GoRouter>((ref) => sqExpertRouter(ref));
