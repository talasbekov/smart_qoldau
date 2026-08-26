// Шапка веб-версии клиента (E15) по прототипам `SmartQoldau Web -
// Каталог` и лендингу: логотип слева, разделы и кнопка «Мне нужна
// помощь» справа. На телефоне шапки нет — там нижняя навигация, как
// было.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:app_client/features/shell/ui/web_header.dart';
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
      home: Scaffold(
        body: WebHeader(
          onHelp: () {},
          onSection: (_) {},
          child: const Text('содержимое'),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('десктоп: логотип, разделы и кнопка помощи', (tester) async {
    await _pumpAt(tester, const Size(1440, 900));

    expect(find.byKey(const Key('sq-web-logo')), findsOneWidget);
    expect(find.byKey(const Key('sq-web-cta-help')), findsOneWidget);
    expect(find.byKey(const Key('sq-web-nav-catalog')), findsOneWidget);
    expect(find.byKey(const Key('sq-web-nav-materials')), findsOneWidget);
    expect(find.text('содержимое'), findsOneWidget);
  });

  testWidgets('телефон: шапки нет, содержимое как было', (tester) async {
    await _pumpAt(tester, const Size(390, 844));

    expect(find.byKey(const Key('sq-web-logo')), findsNothing);
    expect(find.text('содержимое'), findsOneWidget);
  });

  testWidgets('кнопка помощи зовёт обработчик', (tester) async {
    var called = false;
    tester.view.physicalSize = const Size(1440, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('ru'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: WebHeader(
            onHelp: () => called = true,
            onSection: (_) {},
            child: const SizedBox.shrink(),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sq-web-cta-help')));
    expect(called, isTrue);
  });

  testWidgets('на 1280 dp ничего не переполняется', (tester) async {
    await _pumpAt(tester, const Size(1280, 800));
    expect(tester.takeException(), isNull);
  });
}
