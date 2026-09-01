// Шторка или диалог (E15): мобильная идиома не должна растягиваться на
// монитор.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

Future<void> _openAt(WidgetTester tester, Size size) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => TextButton(
            onPressed: () => showSqSheetOrDialog<void>(
              context: context,
              builder: (_) => const SizedBox(
                key: Key('sq-sheet-content'),
                height: 200,
                child: Text('содержимое'),
              ),
            ),
            child: const Text('открыть'),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('открыть'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('телефон: шторка снизу', (tester) async {
    await _openAt(tester, const Size(390, 844));

    expect(find.byType(BottomSheet), findsOneWidget);
    expect(find.byType(Dialog), findsNothing);
  });

  testWidgets('десктоп: диалог по центру, а не шторка во всю ширину', (
    tester,
  ) async {
    await _openAt(tester, const Size(1440, 900));

    expect(find.byType(Dialog), findsOneWidget);
    expect(find.byType(BottomSheet), findsNothing);
  });

  testWidgets('десктоп: ширина диалога ограничена', (tester) async {
    await _openAt(tester, const Size(1440, 900));

    final width = tester
        .getSize(find.byKey(const Key('sq-sheet-content')))
        .width;
    expect(width, lessThanOrEqualTo(520));
  });

  testWidgets('содержимое одно и то же на обоих размерах', (tester) async {
    await _openAt(tester, const Size(390, 844));
    expect(find.text('содержимое'), findsOneWidget);
  });
}
