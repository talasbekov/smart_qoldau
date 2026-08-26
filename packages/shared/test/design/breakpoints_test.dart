// Раскладка выбирается по ширине окна, а не по платформе: планшет и
// складной телефон обязаны попадать в ту же ветку, что окно такой же
// ширины на десктопе. Переключение по платформе — прямая дорога к
// «на планшете выглядит как растянутый телефон».
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

void main() {
  group('sqLayoutFor', () {
    test('границы: снизу включительно', () {
      expect(sqLayoutFor(320), SqLayout.phone);
      expect(sqLayoutFor(719.9), SqLayout.phone);
      expect(sqLayoutFor(720), SqLayout.tablet);
      expect(sqLayoutFor(1279.9), SqLayout.tablet);
      expect(sqLayoutFor(1280), SqLayout.desktop);
      expect(sqLayoutFor(2560), SqLayout.desktop);
    });

    test('вырожденная ширина не роняет выбор', () {
      // Первый кадр иногда приходит с нулевым размером окна.
      expect(sqLayoutFor(0), SqLayout.phone);
    });
  });

  group('SqLayoutScope.of', () {
    Future<SqLayout> layoutAt(WidgetTester tester, Size size) async {
      late SqLayout seen;
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          home: Builder(
            builder: (context) {
              seen = SqLayoutScope.of(context);
              return const SizedBox.shrink();
            },
          ),
        ),
      );
      return seen;
    }

    testWidgets('телефон', (tester) async {
      expect(await layoutAt(tester, const Size(390, 844)), SqLayout.phone);
    });

    testWidgets('планшет', (tester) async {
      expect(await layoutAt(tester, const Size(834, 1112)), SqLayout.tablet);
    });

    testWidgets('десктоп', (tester) async {
      expect(await layoutAt(tester, const Size(1440, 900)), SqLayout.desktop);
    });
  });

  group('удобные проверки', () {
    test('isWide верен для планшета и десктопа', () {
      expect(SqLayout.phone.isWide, isFalse);
      expect(SqLayout.tablet.isWide, isTrue);
      expect(SqLayout.desktop.isWide, isTrue);
    });
  });
}
