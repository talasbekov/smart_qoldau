// Виджет-тесты экрана эскалации Р-16 (Step 1 брифа задачи 11): номера из
// события `request.updated`, фолбэк на константу и звонок по тапу.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:app_client/core/route_paths.dart';
import 'package:app_client/core/url_launcher_port.dart';
import 'package:app_client/features/emergency/ui/hotlines_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class _FakeUrlLauncherPort implements UrlLauncherPort {
  final List<String> launched = [];

  @override
  Future<void> launch(String url) async => launched.add(url);
}

Widget _wrap({List<String>? hotlines, required UrlLauncherPort launcher}) {
  final router = GoRouter(
    initialLocation: RoutePaths.emergencyHotlines,
    routes: [
      GoRoute(
        path: RoutePaths.emergencyHotlines,
        builder: (context, state) => HotlinesScreen(hotlines: hotlines),
      ),
      GoRoute(
        path: RoutePaths.home,
        builder: (context, state) => const Scaffold(body: Text('sq-stub-home')),
      ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    overrides: [urlLauncherPortProvider.overrideWithValue(launcher)],
    child: MaterialApp.router(
      routerConfig: router,
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  );
}

void main() {
  testWidgets('показывает номера, пришедшие с событием заявки', (tester) async {
    await tester.pumpWidget(
      _wrap(
        hotlines: const ['150', '103', '112'],
        launcher: _FakeUrlLauncherPort(),
      ),
    );
    await tester.pump();

    expect(find.text('150'), findsOneWidget);
    expect(find.text('103'), findsOneWidget);
    expect(find.text('112'), findsOneWidget);
    expect(find.text('Телефон доверия'), findsOneWidget);
  });

  testWidgets('пустой список номеров заменяется фолбэком 150/103/112', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(hotlines: const [], launcher: _FakeUrlLauncherPort()),
    );
    await tester.pump();

    expect(find.text('150'), findsOneWidget);
    expect(find.text('103'), findsOneWidget);
    expect(find.text('112'), findsOneWidget);
  });

  testWidgets('отсутствующий список номеров тоже заменяется фолбэком', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(launcher: _FakeUrlLauncherPort()));
    await tester.pump();

    expect(find.text('150'), findsOneWidget);
  });

  testWidgets('тап по номеру 150 звонит на tel:150', (tester) async {
    final launcher = _FakeUrlLauncherPort();
    await tester.pumpWidget(
      _wrap(hotlines: const ['150', '103', '112'], launcher: launcher),
    );
    await tester.pump();

    await tester.tap(find.text('Позвонить 150'));
    await tester.pump();

    expect(launcher.launched, ['tel:150']);
  });

  testWidgets('«На главную» возвращает на главный экран', (tester) async {
    await tester.pumpWidget(
      _wrap(hotlines: const ['150'], launcher: _FakeUrlLauncherPort()),
    );
    await tester.pump();

    await tester.tap(find.text('На главную'));
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-home'), findsOneWidget);
  });
}
