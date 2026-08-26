// Раскладка видеосессии (E14, задача 5) по прототипу
// `docs/Прототип/SmartQoldau Expert Web - Видеоконсультация.dc.html`:
// видео занимает основную площадь, справа панель чата шириной 320 px.
// На телефоне ничего не меняется — там чат остаётся отдельным экраном.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:app_expert/features/session/ui/session_layout.dart';
import 'package:app_expert/l10n/app_localizations.dart';

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
      home: const SessionLayout(
        media: ColoredBox(color: Colors.black, child: Text('видео')),
        chat: ColoredBox(color: Colors.white, child: Text('чат')),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('десктоп: чат панелью 320 px справа от видео', (tester) async {
    await _pumpAt(tester, const Size(1440, 900));

    final chat = find.byKey(const Key('sq-session-chat-panel'));
    expect(chat, findsOneWidget);
    expect(tester.getSize(chat).width, 320);

    // Чат правее видео, а не под ним: психолог видит и лицо, и переписку.
    expect(
      tester.getTopLeft(chat).dx,
      greaterThan(tester.getTopLeft(find.text('видео')).dx),
    );
  });

  testWidgets('телефон: панели чата нет, видео на весь экран', (tester) async {
    await _pumpAt(tester, const Size(390, 844));

    expect(find.byKey(const Key('sq-session-chat-panel')), findsNothing);
    expect(find.text('видео'), findsOneWidget);
  });

  testWidgets('планшет: панель уже, но чат виден', (tester) async {
    await _pumpAt(tester, const Size(1000, 800));

    final chat = find.byKey(const Key('sq-session-chat-panel'));
    expect(chat, findsOneWidget);
    expect(tester.getSize(chat).width, lessThan(320));
  });

  testWidgets('на 1280 dp ничего не переполняется', (tester) async {
    await _pumpAt(tester, const Size(1280, 800));
    expect(tester.takeException(), isNull);
  });
}
