// Недельная сетка расписания (E14) по прототипу `Expert Web -
// Расписание`: семь колонок в ряд на широком экране, прежние строки на
// телефоне.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/schedule/ui/day_row.dart';
import 'package:app_expert/l10n/app_localizations.dart';

ScheduleDay _day(int weekday) => ScheduleDay(
  weekday: weekday,
  enabled: true,
  startMin: 9 * 60,
  endMin: 18 * 60,
);

Future<void> _pumpAt(
  WidgetTester tester,
  Size size, {
  required bool compact,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        locale: const Locale('ru'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: SizedBox(
            width: compact ? 170 : 600,
            child: DayRow(
              day: _day(1),
              compact: compact,
              onToggle: () {},
              onPickStart: () {},
              onPickEnd: () {},
              onPickBreakStart: () {},
              onPickBreakEnd: () {},
              onClearBreak: () {},
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('компактно: поля времени друг под другом', (tester) async {
    await _pumpAt(tester, const Size(1440, 1024), compact: true);

    final start = tester.getTopLeft(find.byKey(const Key('day-1-start')));
    final end = tester.getTopLeft(find.byKey(const Key('day-1-end')));
    expect(end.dy, greaterThan(start.dy));
    expect(tester.takeException(), isNull);
  });

  testWidgets('обычно: поля времени рядом, как было', (tester) async {
    await _pumpAt(tester, const Size(390, 844), compact: false);

    final start = tester.getTopLeft(find.byKey(const Key('day-1-start')));
    final end = tester.getTopLeft(find.byKey(const Key('day-1-end')));
    expect(end.dy, start.dy);
    expect(end.dx, greaterThan(start.dx));
  });
}
