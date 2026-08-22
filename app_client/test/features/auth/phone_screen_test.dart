// Виджет-тесты PhoneScreen: маска `+7 (7XX) XXX-XX-XX`, кнопка активна
// только при полных 9 набранных цифрах, наружу уходит нормализованный
// `+77XXXXXXXXX`.
//
// Добавлены сверх минимального списка тестов брифа задачи 5. Первая версия
// этого файла проверяла маску только одним вызовом `tester.enterText`,
// который сразу подставляет ПОЛНУЮ строку — это не вскрывает баги, которые
// проявляются только при накоплении текста поштучным вводом (ровно так
// нашёлся реальный дефект на код-ревью: `formatEditUpdate` извлекал цифры
// из уже отформатированного текста предыдущего прохода, из-за чего
// фиксированный литеральный префикс маски "+7 (7" на каждом нажатии
// пересчитывался как будто бы набранный заново, и поле раздувалось
// фантомными семёрками). Тесты ниже эмулируют посимвольный ввод реальной
// клавиатурой — каждый вызов `tester.enterText` передаёт ТЕКУЩИЙ текст
// поля плюс один новый символ, как это делает сам `TextField` при вводе с
// клавиатуры.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:shared/shared.dart';

import 'package:app_client/core/providers.dart';
import 'package:app_client/core/token_store.dart';
import 'package:app_client/features/auth/ui/code_screen.dart';
import 'package:app_client/features/auth/ui/phone_screen.dart';
import 'package:app_client/l10n/app_localizations.dart';

class MockSqApi extends Mock implements SqApi {}

class _FakeSecureStore implements SecureStore {
  @override
  Future<String?> read(String key) async => null;

  @override
  Future<void> write(String key, String value) async {}

  @override
  Future<void> delete(String key) async {}
}

Widget _wrap(SqApi api, Widget child) {
  return ProviderScope(
    overrides: [
      sqApiProvider.overrideWithValue(api),
      secureStoreProvider.overrideWithValue(_FakeSecureStore()),
    ],
    child: MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    ),
  );
}

String _fieldText(WidgetTester tester) =>
    tester.widget<TextField>(find.byType(TextField)).controller!.text;

bool _buttonEnabled(WidgetTester tester) =>
    tester.widget<InkWell>(find.byType(InkWell)).onTap != null;

/// Печатает [chars] по одному символу за раз, каждый раз передавая в
/// `tester.enterText` текущий текст поля плюс новый символ — именно так
/// `TextField` получает `newValue` от настоящей клавиатуры при вставке в
/// конец (курсор форматтер всегда коллапсирует в конец текста).
Future<void> _typeOneByOne(WidgetTester tester, String chars) async {
  final field = find.byType(TextField);
  for (final ch in chars.split('')) {
    await tester.enterText(field, _fieldText(tester) + ch);
    await tester.pump();
  }
}

/// Стирает [count] последних символов по одному нажатием backspace —
/// каждый раз укорачивает текущий текст поля на 1 символ с конца.
Future<void> _backspace(WidgetTester tester, int count) async {
  final field = find.byType(TextField);
  for (var i = 0; i < count; i++) {
    final current = _fieldText(tester);
    await tester.enterText(field, current.substring(0, current.length - 1));
    await tester.pump();
  }
}

void main() {
  setUpAll(() {
    registerFallbackValue('+77123456789');
  });

  testWidgets(
    'посимвольный ввод: на 8-й цифре кнопка выключена, на 9-й включена, поле без мусора',
    (tester) async {
      await tester.pumpWidget(_wrap(MockSqApi(), const PhoneScreen()));

      await _typeOneByOne(tester, '70123456'); // 8 цифр
      expect(_fieldText(tester), '70) 123-45-6');
      expect(_buttonEnabled(tester), isFalse);

      await _typeOneByOne(tester, '7'); // 9-я цифра
      expect(_fieldText(tester), '70) 123-45-67');
      expect(_buttonEnabled(tester), isTrue);
    },
  );

  testWidgets(
    'посимвольный ввод девяти цифр наружу отдаёт +77XXXXXXXXX без символов маски',
    (tester) async {
      final api = MockSqApi();
      when(() => api.requestCode(any())).thenAnswer((_) async {});
      await tester.pumpWidget(_wrap(api, const PhoneScreen()));

      await _typeOneByOne(tester, '701234567');
      expect(_buttonEnabled(tester), isTrue);

      tester.widget<InkWell>(find.byType(InkWell)).onTap!();
      await tester.pumpAndSettle();

      verify(() => api.requestCode('+77701234567')).called(1);
      expect(find.byType(CodeScreen), findsOneWidget);
    },
  );

  testWidgets(
    'вставка полного номера из буфера обмена (с кодом страны) распознаётся корректно',
    (tester) async {
      final api = MockSqApi();
      when(() => api.requestCode(any())).thenAnswer((_) async {});
      await tester.pumpWidget(_wrap(api, const PhoneScreen()));

      // Вставка происходит одним действием (весь текст сразу), а не по
      // символу — так `TextField` получает вставку из буфера обмена.
      await tester.enterText(find.byType(TextField), '+77123456789');
      await tester.pump();

      expect(_fieldText(tester), '12) 345-67-89');
      expect(_buttonEnabled(tester), isTrue);

      tester.widget<InkWell>(find.byType(InkWell)).onTap!();
      await tester.pumpAndSettle();

      verify(() => api.requestCode('+77123456789')).called(1);
    },
  );

  testWidgets(
    'ручной ввод "+7" перед номером не ломает ввод — итоговые 9 цифр корректны',
    (tester) async {
      final api = MockSqApi();
      when(() => api.requestCode(any())).thenAnswer((_) async {});
      await tester.pumpWidget(_wrap(api, const PhoneScreen()));

      // Пользователь набирает "+7", а затем свой номер "123456789" — ровно
      // так, как будто уже вбитый в маску литеральный "+7 (7" ему не виден
      // и он повторяет код страны сам.
      await _typeOneByOne(tester, '+7123456789');

      expect(_fieldText(tester), '12) 345-67-89');
      expect(_buttonEnabled(tester), isTrue);

      tester.widget<InkWell>(find.byType(InkWell)).onTap!();
      await tester.pumpAndSettle();

      verify(() => api.requestCode('+77123456789')).called(1);
    },
  );

  testWidgets(
    'backspace удаляет ровно по одной цифре, обратным ходом той же маски',
    (tester) async {
      await tester.pumpWidget(_wrap(MockSqApi(), const PhoneScreen()));

      await _typeOneByOne(tester, '123456789');
      expect(_fieldText(tester), '12) 345-67-89');
      expect(_buttonEnabled(tester), isTrue);

      await _backspace(tester, 3);

      expect(_fieldText(tester), '12) 345-6');
      expect(
        _buttonEnabled(tester),
        isFalse,
        reason: 'после стирания 3 цифр осталось 6 — кнопка должна выключиться',
      );
    },
  );
}
