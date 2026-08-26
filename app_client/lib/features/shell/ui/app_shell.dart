/// Оболочка нижней навигации из четырёх вкладок: Главная, Каталог,
/// Консультации, Профиль (см. `router.dart`, `StatefulShellRoute
/// .indexedStack`).
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared/shared.dart';

import '../../../core/route_paths.dart';
import '../../../l10n/app_localizations.dart';
import 'web_header.dart';

/// Общий каркас четырёх вкладок `StatefulShellRoute.indexedStack`.
///
/// Использует `StatefulShellRoute` (а не более простой `ShellRoute` из
/// первой версии этого файла), потому что у `ShellRoute` только один общий
/// `Navigator` на все вкладки — `context.go('/catalog')` полностью заменял
/// стек, и системная кнопка «назад» с пустой вкладки проваливалась сквозь
/// приложение (выход, а не переход на «Главная»). `StatefulShellRoute
/// .indexedStack` держит СВОЙ `Navigator` на каждую вкладку — задачи 16/17/19
/// смогут строить внутреннюю навигацию (каталог → карточка специалиста) без
/// повторного переписывания оболочки. Ревью раунда 1 задачи 7 эпика E6.
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _onDestinationSelected(int index) {
    // `initialLocation: true` при повторном тапе по уже открытой вкладке —
    // стандартный приём `go_router`: сбрасывает стек ЭТОЙ вкладки на её
    // корневой маршрут, а не просто переключает `IndexedStack` без эффекта.
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

    return PopScope(
      // На «Главной» (индекс 0) системный «назад» ведёт себя как обычно
      // (выход из приложения, если стека нет). На любой другой вкладке —
      // сначала возвращает на «Главную», а не выходит из приложения; если у
      // вкладки есть собственная глубина (появится в задачах 16/17/19), её
      // Navigator обработает «назад» САМ, раньше, чем дойдёт до этого
      // `PopScope` — сюда попадают только уже опустевшие вкладки.
      canPop: navigationShell.currentIndex == 0,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        navigationShell.goBranch(0);
      },
      child: Scaffold(
        // На широком экране разделы живут в веб-шапке (прототипы
        // `SmartQoldau Web - *`), а нижняя навигация исчезает: полоса с
        // четырьмя иконками внизу монитора выглядит как растянутый
        // телефон и ничего не даёт.
        body: SqLayoutScope.of(context).isWide
            ? WebHeader(
                onHelp: () => context.push(RoutePaths.emergency),
                onSection: (section) => switch (section) {
                  WebSection.catalog => context.go(RoutePaths.catalog),
                  WebSection.materials => context.go(RoutePaths.materials),
                  WebSection.premium => context.push(RoutePaths.premium),
                },
                child: navigationShell,
              )
            : navigationShell,
        bottomNavigationBar: SqLayoutScope.of(context).isWide
            ? null
            : NavigationBar(
          selectedIndex: navigationShell.currentIndex,
          onDestinationSelected: _onDestinationSelected,
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
              key: const Key('sq-nav-materials'),
              icon: const Icon(Icons.library_books_outlined),
              selectedIcon: const Icon(Icons.library_books),
              label: l10n.navMaterials,
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
      ),
    );
  }
}
