// Раскладка Premium (E15) по прототипу `SmartQoldau Web - Premium`:
// на широком экране два тарифа сравниваются колонками «Базовый» и
// «Premium» со списками возможностей.
//
// Цены берутся НЕ из прототипа: там 4 990 ₸/мес — устаревшее значение,
// расхождение №1, закрытое решением Р-08 (2 990 ₸/мес и 23 900 ₸/год).
// Из прототипа здесь только раскладка.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:app_client/features/premium/ui/plan_comparison.dart';
import 'package:app_client/l10n/app_localizations.dart';

Future<void> _pumpAt(WidgetTester tester, Size size) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const Scaffold(body: PlanComparison()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('десктоп: две колонки рядом', (tester) async {
    await _pumpAt(tester, const Size(1440, 1024));

    final basic = find.byKey(const Key('sq-plan-basic'));
    final premium = find.byKey(const Key('sq-plan-premium'));
    expect(basic, findsOneWidget);
    expect(premium, findsOneWidget);
    expect(
      tester.getTopLeft(premium).dx,
      greaterThan(tester.getTopLeft(basic).dx),
    );
    expect(tester.getTopLeft(premium).dy, tester.getTopLeft(basic).dy);
  });

  testWidgets('телефон: колонки друг под другом', (tester) async {
    await _pumpAt(tester, const Size(390, 844));

    final basic = tester.getTopLeft(find.byKey(const Key('sq-plan-basic')));
    final premium = tester.getTopLeft(find.byKey(const Key('sq-plan-premium')));
    expect(premium.dy, greaterThan(basic.dy));
  });

  testWidgets('цена по Р-08, а не из устаревшего прототипа', (tester) async {
    await _pumpAt(tester, const Size(1440, 1024));

    expect(find.textContaining('2 990'), findsOneWidget);
    expect(find.textContaining('4 990'), findsNothing);
  });

  testWidgets('возможности перечислены обеим сторонам', (tester) async {
    await _pumpAt(tester, const Size(1440, 1024));

    expect(find.textContaining('Подбор специалиста'), findsOneWidget);
    expect(find.textContaining('Скидка на консультации'), findsOneWidget);
  });
}
