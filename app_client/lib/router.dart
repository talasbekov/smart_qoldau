/// Навигация-оболочка приложения: редирект-гард сессии/онбординга и
/// таблица маршрутов (`go_router`).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import 'core/route_paths.dart';
import 'features/auth/state/auth_controller.dart';
import 'features/auth/ui/splash_screen.dart';
import 'features/catalog/ui/catalog_screen.dart';
import 'features/consultations/ui/consultations_screen.dart';
import 'features/emergency/ui/emergency_screen.dart';
import 'features/home/ui/home_screen.dart';
import 'features/onboarding/state/onboarding_flags.dart';
import 'features/onboarding/ui/permissions_screen.dart';
import 'features/onboarding/ui/slides_screen.dart';
import 'features/onboarding/ui/welcome_screen.dart';
import 'features/profile/ui/profile_screen.dart';
import 'features/session/ui/session_screen.dart';
import 'features/found/ui/found_screen.dart';
import 'features/shell/ui/app_shell.dart';
import 'features/funnel/state/search_controller.dart';
import 'features/funnel/ui/search_screen.dart';
import 'features/funnel/ui/topic_screen.dart';

/// Пути, на которых пользователь обязан ОСТАВАТЬСЯ, пока не выполнено их
/// условие (см. [_redirect]), и с которых он обязан УЙТИ, как только оно
/// выполнено — иначе, например, уже полностью авторизованный человек,
/// вернувшийся на `/welcome` аппаратной кнопкой «назад» или по старой
/// ссылке, застрял бы там навсегда.
const _gatedPaths = {
  RoutePaths.splash,
  RoutePaths.welcome,
  RoutePaths.onboarding,
  RoutePaths.permissions,
};

/// Реактивно просит `GoRouter` заново вычислить [_redirect], когда меняется
/// состояние аутентификации: успешный вход, восстановление сессии
/// (`SplashScreen` → `AuthController.restore()`) или принудительный
/// разлогин (`sessionInvalidatedProvider`, на который уже подписан сам
/// `AuthController`, см. `core/providers.dart`).
///
/// НЕ вызывает `restore()` и вообще не управляет `AuthController` — только
/// слушает уже готовый результат. Если бы редирект или этот нотифайер сами
/// дёргали `restore()`, восстановление сессии перезапускалось бы при каждой
/// перестройке роутера (см. disambiguation №5 брифа задачи 7) — вместо
/// этого `restore()` остаётся тем, чем был с задачи 5: обязанностью
/// `SplashScreen.initState`, вызываемой ровно один раз за жизнь приложения.
class _AuthRefreshNotifier extends ChangeNotifier {
  _AuthRefreshNotifier(Ref ref) {
    ref.listen<AsyncValue<AuthState>>(
      authControllerProvider,
      (previous, next) => notifyListeners(),
    );
  }
}

/// Редирект-гард сессии — таблица дословно из брифа задачи 7:
/// `AuthUnknown` → `/splash`; `AuthAnonymous` → `/welcome`; авторизован и
/// `!seenSlides` → `/onboarding`; авторизован и `!askedPermissions` →
/// `/permissions`; иначе вход в `StatefulShellRoute` (и любой другой
/// зарегистрированный маршрут вне [_gatedPaths]) разрешён без редиректа.
///
/// Читает состояние через `ref.read`, а не `ref.watch`: эту функцию
/// вызывает сам `go_router` (на каждой навигации и при срабатывании
/// [_AuthRefreshNotifier]), а не Riverpod — `ref.watch` внутри нужен был бы
/// только провайдеру, который могли бы пересобрать при изменении
/// зависимости, а `_redirect` не провайдер и каждый раз получает свежее
/// значение напрямую через `ref.read`.
String? _redirect(Ref ref, GoRouterState state) {
  final location = state.matchedLocation;
  final authState = ref.read(authControllerProvider).valueOrNull;

  if (authState == null || authState is AuthUnknown) {
    return location == RoutePaths.splash ? null : RoutePaths.splash;
  }
  if (authState is AuthAnonymous) {
    return location == RoutePaths.welcome ? null : RoutePaths.welcome;
  }

  // Ниже — AuthGuest или AuthRegistered: сессия есть, дело за онбордингом.
  final flags = ref.read(onboardingFlagsProvider);
  if (!flags.seenSlides) {
    return location == RoutePaths.onboarding ? null : RoutePaths.onboarding;
  }
  if (!flags.askedPermissions) {
    return location == RoutePaths.permissions ? null : RoutePaths.permissions;
  }

  // Полностью авторизован и прошёл онбординг — на "гейтовых" путях делать
  // больше нечего.
  if (_gatedPaths.contains(location)) return RoutePaths.home;
  return null;
}

/// Собирает `GoRouter` приложения. Принимает `Ref`, а не `WidgetRef` —
/// вызывается один раз из [routerProvider], а не из виджета.
GoRouter sqRouter(Ref ref) {
  final refresh = _AuthRefreshNotifier(ref);

  return GoRouter(
    initialLocation: RoutePaths.splash,
    refreshListenable: refresh,
    redirect: (context, state) => _redirect(ref, state),
    routes: [
      GoRoute(
        path: RoutePaths.splash,
        builder: (context, state) =>
            SplashScreen(onRestored: (context, state) {}),
      ),
      GoRoute(
        path: RoutePaths.welcome,
        builder: (context, state) => const WelcomeScreen(),
      ),
      GoRoute(
        path: RoutePaths.onboarding,
        builder: (context, state) =>
            SlidesScreen(onFinished: () => context.go(RoutePaths.home)),
      ),
      GoRoute(
        path: RoutePaths.permissions,
        builder: (context, state) =>
            PermissionsScreen(onFinished: () => context.go(RoutePaths.home)),
      ),
      GoRoute(
        path: RoutePaths.emergency,
        builder: (context, state) => const EmergencyScreen(),
      ),
      GoRoute(
        // Список горячих линий Р-16 — пока тот же экран-заглушка, что и
        // `/emergency`: настоящий добавляет задача 11 эпика E6. Маршрут
        // зарегистрирован уже сейчас, потому что экран поиска уводит сюда
        // при статусе заявки `CALLBACK_REQUESTED`.
        path: RoutePaths.emergencyHotlines,
        builder: (context, state) => const EmergencyScreen(),
      ),
      GoRoute(
        path: RoutePaths.topic,
        builder: (context, state) => TopicScreen(
          slug: state.uri.queryParameters['slug'],
          // Название темы передаёт главный экран через `extra` — справочник
          // тем у него уже загружен, отдельного запроса ради одной строки
          // не нужно. При переходе по прямой ссылке `extra` пуст, и экран
          // покажет сам slug.
          topicName: (state.extra as Topic?)?.name,
        ),
      ),
      GoRoute(
        path: RoutePaths.searchPattern,
        builder: (context, state) {
          final requestId = state.pathParameters['requestId']!;
          // `extra` несёт тему и формат (их нет в `GET /requests/{id}`,
          // см. `SearchArgs`). При открытии по прямой ссылке его нет —
          // поиск работает, но без счётчика «Сейчас онлайн».
          final args = state.extra as SearchArgs?;
          return SearchScreen(
            args: args?.requestId == requestId
                ? args!
                : SearchArgs(requestId: requestId),
          );
        },
      ),
      GoRoute(
        path: RoutePaths.foundPattern,
        builder: (context, state) =>
            FoundScreen(requestId: state.pathParameters['requestId']!),
      ),
      GoRoute(
        path: RoutePaths.sessionPattern,
        builder: (context, state) =>
            SessionScreen(consultationId: state.pathParameters['id']!),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RoutePaths.home,
                builder: (context, state) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RoutePaths.catalog,
                builder: (context, state) => const CatalogScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RoutePaths.consultations,
                builder: (context, state) => const ConsultationsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: RoutePaths.profile,
                builder: (context, state) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
}

/// `GoRouter` приложения — единственный инстанс на всё время жизни
/// `ProviderScope` (пересоздание сбросило бы стек навигации), поэтому
/// `app.dart` держит его через `ref.watch(routerProvider)`, а не создаёт сам.
final routerProvider = Provider<GoRouter>((ref) => sqRouter(ref));
