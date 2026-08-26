// Плитки дохода (E14) по прототипу `Expert Web - Доход`: доход за период,
// число консультаций, средний чек и комиссия платформы в один ряд.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/earnings/ui/earnings_stats.dart';
import 'package:app_expert/l10n/app_localizations.dart';

EarningsItemDto _item(int price) => EarningsItemDto(
  consultationId: 'c-$price',
  priceTiyn: price,
  commissionTiyn: (price * 0.15).round(),
  netTiyn: price - (price * 0.15).round(),
  createdAt: DateTime(2026, 8, 27),
);

Future<void> _pumpAt(
  WidgetTester tester,
  Size size, {
  required List<EarningsItemDto> items,
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
      home: Scaffold(body: EarningsStats(items: items)),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('четыре плитки прототипа', (tester) async {
    await _pumpAt(
      tester,
      const Size(1440, 900),
      items: [_item(399000), _item(399000), _item(500000)],
    );

    expect(find.byKey(const Key('sq-earnings-stat-total')), findsOneWidget);
    expect(find.byKey(const Key('sq-earnings-stat-count')), findsOneWidget);
    expect(find.byKey(const Key('sq-earnings-stat-average')), findsOneWidget);
    expect(
      find.byKey(const Key('sq-earnings-stat-commission')),
      findsOneWidget,
    );
  });

  testWidgets('доход — это НЕТТО эксперта, а не цена клиента', (tester) async {
    await _pumpAt(tester, const Size(1440, 900), items: [_item(399000)]);

    // Плитка «доход» показывает НЕТТО (цена минус 15 %), а не то, что
    // заплатил клиент. Сравниваем через formatTenge, а не строковым
    // литералом: разделитель тысяч там неразрывный пробел, и ручная
    // строка ловит ложное расхождение.
    expect(
      find.descendant(
        of: find.byKey(const Key('sq-earnings-stat-total')),
        matching: find.text(formatTenge(399000 - (399000 * 0.15).round())),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byKey(const Key('sq-earnings-stat-total')),
        matching: find.text(formatTenge(399000)),
      ),
      findsNothing,
    );
  });

  testWidgets('средний чек считается по полной цене', (tester) async {
    await _pumpAt(
      tester,
      const Size(1440, 900),
      items: [_item(400000), _item(200000)],
    );
    expect(
      find.descendant(
        of: find.byKey(const Key('sq-earnings-stat-average')),
        matching: find.text(formatTenge(300000)),
      ),
      findsOneWidget,
    );
  });

  testWidgets('пусто: нули, а не пустой экран', (tester) async {
    await _pumpAt(tester, const Size(1440, 900), items: []);
    expect(find.byKey(const Key('sq-earnings-stat-count')), findsOneWidget);
    expect(find.text('0'), findsOneWidget);
  });

  testWidgets('телефон: плитки в две колонки, ничего не переполняется', (
    tester,
  ) async {
    await _pumpAt(tester, const Size(390, 844), items: [_item(399000)]);
    expect(tester.takeException(), isNull);
  });
}
