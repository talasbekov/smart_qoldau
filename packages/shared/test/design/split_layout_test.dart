// Двухколоночная раскладка (E14/E15). Пропорция 1.4 : 1 — из прототипов
// `Web - Профиль психолога` и `Expert Web - Главная`, где основная
// колонка шире боковой примерно в полтора раза.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

Future<void> _pumpAt(WidgetTester tester, Size size) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    const MaterialApp(
      home: Scaffold(
        body: SqSplitLayout(
          main: SizedBox(key: Key('main'), height: 100),
          aside: SizedBox(key: Key('aside'), height: 100),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('десктоп: колонки рядом, основная шире', (tester) async {
    await _pumpAt(tester, const Size(1440, 900));

    final main = tester.getSize(find.byKey(const Key('main')));
    final aside = tester.getSize(find.byKey(const Key('aside')));
    expect(main.width, greaterThan(aside.width));
    // 1.4 : 1 из прототипа, с допуском на отступ между колонками.
    expect(main.width / aside.width, closeTo(1.4, 0.15));
    expect(
      tester.getTopLeft(find.byKey(const Key('aside'))).dx,
      greaterThan(tester.getTopLeft(find.byKey(const Key('main'))).dx),
    );
  });

  testWidgets('телефон: одна колонка, боковая уходит вниз', (tester) async {
    await _pumpAt(tester, const Size(390, 844));

    expect(
      tester.getTopLeft(find.byKey(const Key('aside'))).dy,
      greaterThan(tester.getTopLeft(find.byKey(const Key('main'))).dy),
    );
  });

  testWidgets('на 1280 dp ничего не переполняется', (tester) async {
    await _pumpAt(tester, const Size(1280, 800));
    expect(tester.takeException(), isNull);
  });
}
