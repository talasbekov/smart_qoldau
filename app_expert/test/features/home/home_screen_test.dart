// Виджет-тест HomeScreen: свежезарегистрированный эксперт без анкеты
// (GET /experts/me -> 404 EXPERT_NOT_FOUND) автоматически уводится на
// онбординг, а не застревает на тупиковом экране ошибки. Найдено
// сквозным integration_test'ом задачи 17 — до этого перехода не было
// нигде в приложении.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/core/route_paths.dart';
import 'package:app_expert/features/home/ui/home_screen.dart';
import 'package:app_expert/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

Widget _wrap(SqApi api) {
  final router = GoRouter(
    initialLocation: RoutePaths.home,
    routes: [
      GoRoute(
        path: RoutePaths.home,
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: RoutePaths.onboardingProfile,
        builder: (context, state) => const Scaffold(body: Text('sq-stub-onboarding')),
      ),
    ],
  );
  addTearDown(router.dispose);

  return ProviderScope(
    overrides: [sqApiProvider.overrideWithValue(api)],
    child: MaterialApp.router(
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      routerConfig: router,
    ),
  );
}

void main() {
  testWidgets('EXPERT_NOT_FOUND уводит на анкету онбординга', (tester) async {
    final api = MockSqApi();
    when(() => api.me()).thenThrow(
      const ApiException(ApiErrorCode.expertNotFound, 'Эксперт не найден', 404),
    );

    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    expect(find.text('sq-stub-onboarding'), findsOneWidget);
  });
}
