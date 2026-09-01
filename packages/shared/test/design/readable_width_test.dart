import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

Future<double> _widthAt(WidgetTester tester, Size size) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    const MaterialApp(
      home: Scaffold(
        body: SqReadableWidth(
          // width: infinity — иначе виджет схлопывается до нуля и тест
          // меряет не ограничение, а собственный размер заглушки.
          child: SizedBox(
            key: Key('content'),
            height: 100,
            width: double.infinity,
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return tester.getSize(find.byKey(const Key('content'))).width;
}

void main() {
  testWidgets('на мониторе ширина ограничена', (tester) async {
    // Строка в 1400 пикселей не читается: глаз теряет начало следующей.
    expect(await _widthAt(tester, const Size(1440, 900)), 720);
  });

  testWidgets('на телефоне занимает всю ширину', (tester) async {
    expect(await _widthAt(tester, const Size(390, 844)), 390);
  });
}
