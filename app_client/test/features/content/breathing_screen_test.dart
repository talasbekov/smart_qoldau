// Виджет-тесты дыхательной техники (E13): фазы по таймеру и счёт циклов.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/features/content/ui/breathing_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

ContentItem _technique() => const ContentItem(
  id: 'c2',
  kind: ContentKind.breathing,
  access: ContentAccess.free,
  slug: 'box-breathing',
  category: 'anxiety',
  title: 'Квадратное дыхание',
  summary: 'Четыре фазы',
  body: BreathingBody(
    cycles: 2,
    phases: [
      BreathingPhase(name: 'Вдох', seconds: 4),
      BreathingPhase(name: 'Выдох', seconds: 4),
    ],
  ),
);

Widget _wrap(SqApi api) => ProviderScope(
  overrides: [sqApiProvider.overrideWithValue(api)],
  child: const MaterialApp(
    locale: Locale('ru'),
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: BreathingScreen(id: 'c2'),
  ),
);

void main() {
  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
    when(() => api.contentItem('c2')).thenAnswer((_) async => _technique());
    when(() => api.saveContentProgress(any(), any())).thenAnswer(
      (_) async => const ContentProgress(positionPermille: 0, completed: false),
    );
  });

  testWidgets('фазы сменяются по таймеру, циклы считаются', (tester) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    expect(find.textContaining('Вдох'), findsOneWidget);

    await tester.tap(find.byKey(const Key('sq-breathing-start')));
    await tester.pump();
    expect(find.textContaining('Цикл 1'), findsOneWidget);

    await tester.pump(const Duration(seconds: 4));
    expect(find.textContaining('Выдох'), findsOneWidget);

    await tester.pump(const Duration(seconds: 4));
    expect(find.textContaining('Цикл 2'), findsOneWidget);

    // Практика завершена — прогресс уходит на сервер, без этого стрик не
    // считается.
    await tester.pump(const Duration(seconds: 8));
    await tester.pumpAndSettle();
    verify(() => api.saveContentProgress('c2', 1000)).called(1);
  });

  testWidgets('остановка возвращает практику в начало', (tester) async {
    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('sq-breathing-start')));
    await tester.pump(const Duration(seconds: 4));
    await tester.tap(find.byKey(const Key('sq-breathing-start')));
    await tester.pumpAndSettle();

    expect(find.textContaining('Вдох'), findsOneWidget);
    expect(find.textContaining('Цикл'), findsNothing);
  });
}
