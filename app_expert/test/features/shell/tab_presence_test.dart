// Присутствие в вебе (E14, задача 3, Р-26).
//
// В браузере нет data-push с обходом «не беспокоить»: пока вкладка
// открыта — офферы идут по WebSocket, закрыли — не идут вовсе. Значит
// две вещи обязаны быть правдой: статус снимается при уходе, и человек
// знает об этом ЗАРАНЕЕ, а не выясняет по потерянным заявкам.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/shell/state/tab_presence.dart';
import 'package:app_expert/l10n/app_localizations.dart';

Widget _wrap(Widget child) => MaterialApp(
  locale: const Locale('ru'),
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: Scaffold(body: child),
);

void main() {
  group('решение о снятии статуса', () {
    test('уход со страницы снимает ACCEPTING', () {
      expect(
        presenceOnLeave(WorkStatus.accepting),
        WorkStatus.notAccepting,
        reason:
            'иначе эксперт числится онлайн, оффер уходит ему, 45 секунд '
            'горят впустую, а клиент ждёт',
      );
    });

    test('BUSY не трогаем: консультация может идти в другой вкладке', () {
      expect(presenceOnLeave(WorkStatus.busy), isNull);
    });

    test('уже не принимает — менять нечего', () {
      expect(presenceOnLeave(WorkStatus.notAccepting), isNull);
    });
  });

  testWidgets('предупреждение показывается до того, как заявки потеряются', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(const WebPresenceNotice(accepting: true)));

    expect(find.byKey(const Key('sq-web-presence-notice')), findsOneWidget);
    expect(find.textContaining('вкладк'), findsOneWidget);
  });

  testWidgets('когда приём выключен, предупреждать не о чем', (tester) async {
    await tester.pumpWidget(_wrap(const WebPresenceNotice(accepting: false)));

    expect(find.byKey(const Key('sq-web-presence-notice')), findsNothing);
  });
}
