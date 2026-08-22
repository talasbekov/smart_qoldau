/// Оболочка нижней навигации из четырёх вкладок: Главная, Каталог,
/// Консультации, Профиль (см. `router.dart`, `ShellRoute`).
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';

const _tabs = [
  RoutePaths.home,
  RoutePaths.catalog,
  RoutePaths.consultations,
  RoutePaths.profile,
];

/// Общий каркас четырёх вкладок `ShellRoute`.
///
/// [location] — текущий совпавший путь (`GoRouterState.matchedLocation` из
/// `ShellRoute.builder`), передаётся явно параметром, а не читается через
/// `GoRouterState.of(context)` внутри виджета — так `AppShell` остаётся
/// тривиально тестируемым без настоящего роутера в дереве, а вызывающая
/// сторона (`router.dart`) и так уже держит `state` под рукой.
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.location, required this.child});

  final String location;
  final Widget child;

  int get _currentIndex {
    final index = _tabs.indexOf(location);
    return index < 0 ? 0 : index;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) {
          if (index == _currentIndex) return;
          context.go(_tabs[index]);
        },
        destinations: [
          NavigationDestination(
            key: const Key('sq-nav-home'),
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home),
            label: l10n.navHome,
          ),
          NavigationDestination(
            key: const Key('sq-nav-catalog'),
            icon: const Icon(Icons.grid_view_outlined),
            selectedIcon: const Icon(Icons.grid_view),
            label: l10n.navCatalog,
          ),
          NavigationDestination(
            key: const Key('sq-nav-consultations'),
            icon: const Icon(Icons.forum_outlined),
            selectedIcon: const Icon(Icons.forum),
            label: l10n.navConsultations,
          ),
          NavigationDestination(
            key: const Key('sq-nav-profile'),
            icon: const Icon(Icons.person_outline),
            selectedIcon: const Icon(Icons.person),
            label: l10n.navProfile,
          ),
        ],
      ),
    );
  }
}
