// Виджет-тесты ScheduleScreen (E7 задача 8): тап по тумблеру дня визуально
// скрывает/показывает выбор времени; попытка сохранить с endMin<=startMin
// показывает локальную ошибку и НЕ дёргает сеть (updateSchedule не
// зарегистрирован моком — как только его вызовут без `when(...)`, mocktail
// бросит MissingStubError, так что verifyNever ниже — прямая проверка
// того же самого).
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/schedule/state/schedule_controller.dart';
import 'package:app_expert/features/schedule/ui/schedule_screen.dart';
import 'package:app_expert/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

ScheduleDay _day(
  int weekday, {
  bool enabled = true,
  int? startMin = 540,
  int? endMin = 1080,
}) => ScheduleDay(
  weekday: weekday,
  enabled: enabled,
  startMin: startMin,
  endMin: endMin,
);

List<ScheduleDay> _week() => [for (var i = 0; i < 7; i++) _day(i)];

Widget _wrap(SqApi api, {ProviderContainer? container}) {
  return UncontrolledProviderScope(
    container:
        container ??
        (ProviderContainer(overrides: [sqApiProvider.overrideWithValue(api)])
          ..updateOverrides([sqApiProvider.overrideWithValue(api)])),
    child: MaterialApp(
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const ScheduleScreen(),
    ),
  );
}

void main() {
  late MockSqApi api;

  setUp(() {
    api = MockSqApi();
  });

  testWidgets(
    'тап по тумблеру дня скрывает выбор времени, повторный тап возвращает',
    (tester) async {
      when(() => api.schedule()).thenAnswer((_) async => _week());
      final container = ProviderContainer(
        overrides: [sqApiProvider.overrideWithValue(api)],
      );
      addTearDown(container.dispose);

      await tester.pumpWidget(_wrap(api, container: container));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('day-0-start')), findsOneWidget);

      await tester.tap(find.byKey(const Key('day-0-toggle')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('day-0-start')), findsNothing);

      await tester.tap(find.byKey(const Key('day-0-toggle')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('day-0-start')), findsOneWidget);
    },
  );

  testWidgets(
    'save() с endMin<=startMin показывает локальную ошибку и не вызывает сеть',
    (tester) async {
      when(() => api.schedule()).thenAnswer((_) async => _week());
      final container = ProviderContainer(
        overrides: [sqApiProvider.overrideWithValue(api)],
      );
      addTearDown(container.dispose);

      await tester.pumpWidget(_wrap(api, container: container));
      await tester.pumpAndSettle();

      container
          .read(scheduleControllerProvider.notifier)
          .setHours(0, startMin: 600, endMin: 600);
      await tester.pump();

      await tester.scrollUntilVisible(
        find.byKey(const Key('sq-schedule-save')),
        200,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('sq-schedule-save')));
      await tester.pumpAndSettle();

      expect(find.textContaining('позже'), findsOneWidget);
      verifyNever(() => api.updateSchedule(any()));
    },
  );
}
