// Виджет-тесты шторки выбора формата консультации (Step 2 брифа задачи 10).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

import 'package:app_client/features/funnel/ui/format_sheet.dart';
import 'package:app_client/l10n/app_localizations.dart';

Widget _host(void Function(SessionFormat?) onResult) => MaterialApp(
  locale: const Locale('ru'),
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: Scaffold(
    body: Builder(
      builder: (context) => Center(
        child: TextButton(
          onPressed: () async => onResult(await showFormatSheet(context)),
          child: const Text('открыть'),
        ),
      ),
    ),
  ),
);

void main() {
  testWidgets('возвращает выбранный формат', (tester) async {
    SessionFormat? result;
    var called = false;
    await tester.pumpWidget(
      _host((value) {
        result = value;
        called = true;
      }),
    );

    await tester.tap(find.text('открыть'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Аудио'));
    await tester.pumpAndSettle();

    expect(called, isTrue);
    expect(result, SessionFormat.audio);
  });

  testWidgets('каждый вариант подписан длительностью и оговоркой о цене', (
    tester,
  ) async {
    await tester.pumpWidget(_host((_) {}));

    await tester.tap(find.text('открыть'));
    await tester.pumpAndSettle();

    expect(find.text('Чат'), findsOneWidget);
    expect(find.text('Аудио'), findsOneWidget);
    expect(find.text('Видео'), findsOneWidget);
    expect(
      find.text('50 минут · цена зависит от специалиста'),
      findsNWidgets(3),
    );
  });

  testWidgets('закрытие без выбора даёт null', (tester) async {
    SessionFormat? result;
    var called = false;
    await tester.pumpWidget(
      _host((value) {
        result = value;
        called = true;
      }),
    );

    await tester.tap(find.text('открыть'));
    await tester.pumpAndSettle();

    // Тап по затемнению вне шторки — обычный способ закрыть её.
    await tester.tapAt(const Offset(10, 10));
    await tester.pumpAndSettle();

    expect(called, isTrue);
    expect(result, isNull);
  });
}
