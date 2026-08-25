// Виджет-тесты ProfileStepScreen (шаг 1/2 анкеты онбординга): кнопка
// «Далее» неактивна, пока `displayName`/`education` пусты, и заполнение
// полей проверяется посимвольным вводом — тот же приём, что в
// `app_client/test/features/auth/phone_screen_test.dart` (урок 2 плана E6:
// один вызов `tester.enterText` с полной строкой не вскрывает баги
// накопления текста).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared/shared.dart';

import 'package:app_expert/features/onboarding/ui/profile_step_screen.dart';
import 'package:app_expert/l10n/app_localizations.dart';

Widget _wrap(Widget child) => MaterialApp(
      locale: const Locale('ru'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    );

Finder _displayNameField() =>
    find.byKey(const Key('sq-onboarding-display-name'));
Finder _educationField() => find.byKey(const Key('sq-onboarding-education'));
Finder _nextButton() => find.byKey(const Key('sq-onboarding-next'));

String _text(WidgetTester tester, Finder fieldFinder) => tester
    .widget<TextField>(
      find.descendant(of: fieldFinder, matching: find.byType(TextField)),
    )
    .controller!
    .text;

bool _nextEnabled(WidgetTester tester) =>
    tester.widget<SqButton>(_nextButton()).onPressed != null;

/// Печатает [chars] по одному символу за раз в поле [field], каждый раз
/// передавая в `tester.enterText` текущий текст поля плюс новый символ —
/// именно так `TextField` получает `newValue` от настоящей клавиатуры.
Future<void> _typeOneByOne(
  WidgetTester tester,
  Finder field,
  String chars,
) async {
  for (final ch in chars.split('')) {
    await tester.enterText(field, _text(tester, field) + ch);
    await tester.pump();
  }
}

void main() {
  testWidgets(
    'кнопка "Далее" неактивна, пока displayName и education пусты, и включается когда оба заполнены',
    (tester) async {
      await tester.pumpWidget(_wrap(const ProfileStepScreen()));

      expect(
        _nextEnabled(tester),
        isFalse,
        reason: 'изначально оба поля пусты',
      );

      await _typeOneByOne(tester, _displayNameField(), 'Асель Ахметова');
      expect(
        _nextEnabled(tester),
        isFalse,
        reason: 'displayName заполнен, но education всё ещё пуст',
      );

      await _typeOneByOne(tester, _educationField(), 'КазНУ, психология');
      expect(
        _nextEnabled(tester),
        isTrue,
        reason: 'оба обязательных поля заполнены',
      );
    },
  );

  testWidgets(
    'посимвольный ввод накапливает текст без искажений в обоих полях',
    (tester) async {
      await tester.pumpWidget(_wrap(const ProfileStepScreen()));

      await _typeOneByOne(tester, _displayNameField(), 'Асель');
      expect(_text(tester, _displayNameField()), 'Асель');

      await _typeOneByOne(tester, _educationField(), 'КазНУ');
      expect(_text(tester, _educationField()), 'КазНУ');
      // displayName не пострадал от ввода в соседнее поле.
      expect(_text(tester, _displayNameField()), 'Асель');
    },
  );

  testWidgets(
    'стирание последнего символа displayName снова выключает кнопку "Далее"',
    (tester) async {
      await tester.pumpWidget(_wrap(const ProfileStepScreen()));

      await _typeOneByOne(tester, _displayNameField(), 'А');
      await _typeOneByOne(tester, _educationField(), 'К');
      expect(_nextEnabled(tester), isTrue);

      await tester.enterText(_displayNameField(), '');
      await tester.pump();

      expect(_nextEnabled(tester), isFalse);
    },
  );
}
