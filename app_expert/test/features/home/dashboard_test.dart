// Дашборд кабинета (E14) по прототипу `Expert Web - Главная`:
// приветствие, четыре плитки (сегодня, завершено, доход, рейтинг),
// ближайшая консультация. На телефоне остаётся прежний экран-хаб.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/home/ui/dashboard.dart';
import 'package:app_expert/l10n/app_localizations.dart';

ConsultationExpertDto _consultation({
  required ConsultationStatus status,
  required DateTime startedAt,
  int price = 399000,
}) => ConsultationExpertDto(
  id: 'c-${startedAt.microsecondsSinceEpoch}',
  status: status,
  format: SessionFormat.video,
  isEmergency: false,
  startedAt: startedAt,
  clientCode: 1048,
  topicSlug: 'anxiety-stress',
  priceTiyn: price,
  plannedDurationMin: 50,
  paymentStatus: ConsultationPaymentStatus.captured,
);

Future<void> _pumpAt(
  WidgetTester tester,
  Size size, {
  required List<ConsultationExpertDto> today,
  double rating = 4.9,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: Dashboard(
          expertName: 'Айгуль',
          consultations: today,
          ratingAvg: rating,
          now: DateTime(2026, 8, 27, 12),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  final now = DateTime(2026, 8, 27, 12);

  testWidgets('приветствие по имени, как в прототипе', (tester) async {
    await _pumpAt(tester, const Size(1440, 1024), today: []);
    expect(find.textContaining('Айгуль'), findsWidgets);
  });

  testWidgets('четыре плитки: сегодня, завершено, доход, рейтинг', (
    tester,
  ) async {
    await _pumpAt(
      tester,
      const Size(1440, 1024),
      today: [
        _consultation(
          status: ConsultationStatus.completed,
          startedAt: now.subtract(const Duration(hours: 3)),
        ),
        _consultation(
          status: ConsultationStatus.completed,
          startedAt: now.subtract(const Duration(hours: 2)),
        ),
        _consultation(
          status: ConsultationStatus.scheduled,
          startedAt: now.add(const Duration(hours: 6)),
        ),
      ],
    );

    expect(find.byKey(const Key('sq-stat-today')), findsOneWidget);
    expect(find.byKey(const Key('sq-stat-completed')), findsOneWidget);
    expect(find.byKey(const Key('sq-stat-earned')), findsOneWidget);
    expect(find.byKey(const Key('sq-stat-rating')), findsOneWidget);

    // Три консультации сегодня, две завершены.
    expect(find.text('3'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    // Доход считается только по завершённым: 2 × 85 % от 3 990 ₸.
    expect(find.textContaining('6\u00A0783'), findsOneWidget);
    expect(find.textContaining('4.9'), findsOneWidget);
  });

  testWidgets('вчерашние консультации в «сегодня» не попадают', (tester) async {
    await _pumpAt(
      tester,
      const Size(1440, 1024),
      today: [
        _consultation(
          status: ConsultationStatus.completed,
          startedAt: now.subtract(const Duration(days: 1)),
        ),
      ],
    );

    expect(find.byKey(const Key('sq-stat-today')), findsOneWidget);
    expect(find.text('0'), findsWidgets);
  });

  testWidgets('ближайшая консультация показана с временем', (tester) async {
    await _pumpAt(
      tester,
      const Size(1440, 1024),
      today: [
        _consultation(
          status: ConsultationStatus.scheduled,
          startedAt: DateTime(2026, 8, 27, 18, 30),
        ),
      ],
    );

    expect(find.byKey(const Key('sq-dashboard-next')), findsOneWidget);
    expect(find.textContaining('18:30'), findsOneWidget);
  });

  testWidgets('на 1280 dp ничего не переполняется', (tester) async {
    await _pumpAt(tester, const Size(1280, 800), today: []);
    expect(tester.takeException(), isNull);
  });
}
